const express = require('express');
const prisma = require('../prismaClient');
const { requireAdmin } = require('../middleware/auth');
const { sendSms } = require('../utils/sms');

const MAX_ORDERS_PER_SLOT = parseInt(process.env.MAX_ORDERS_PER_SLOT || '8', 10);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildOrdersRouter(sockets) {
  const router = express.Router();

  // GET /api/orders/lookup?phone=55618618 — public
  // Pré-remplit l'adresse d'un client déjà venu + affiche son nombre de commandes.
  router.get('/lookup', async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'Numéro requis.' });

    const clean = phone.replace(/\s/g, '');
    const previous = await prisma.order.findMany({
      where: { customerPhone: { contains: clean } },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: { address: true },
    });
    const count = await prisma.order.count({
      where: { customerPhone: { contains: clean } },
    });

    if (previous.length === 0) {
      return res.json({ known: false, orderCount: 0 });
    }
    const last = previous[0];
    res.json({
      known: true,
      orderCount: count,
      lastOrder: {
        customerName: last.customerName,
        address: last.address.fullAddress,
        zone: last.address.zone,
        latitude: last.address.latitude,
        longitude: last.address.longitude,
      },
    });
  });

  // GET /api/orders/slot-availability — public
  router.get('/slot-availability', async (req, res) => {
    const today = await prisma.order.findMany({
      where: { createdAt: { gte: startOfToday() }, status: { not: 'ANNULEE' } },
      select: { slot: true },
    });
    const counts = {};
    today.forEach((o) => { counts[o.slot] = (counts[o.slot] || 0) + 1; });
    const result = Object.entries(counts).map(([slot, count]) => ({
      slot, count, full: count >= MAX_ORDERS_PER_SLOT,
    }));
    res.json({ maxPerSlot: MAX_ORDERS_PER_SLOT, slots: result });
  });

  // POST /api/orders — public : un client passe commande depuis le site
  router.post('/', async (req, res) => {
    const { customerName, customerPhone, address, zone, slot, notes, items, latitude, longitude } = req.body;

    if (!customerName || !customerPhone || !address || !zone || !slot) {
      return res.status(400).json({ error: 'Coordonnées incomplètes.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Le panier est vide.' });
    }

    const slotCount = await prisma.order.count({
      where: { slot, createdAt: { gte: startOfToday() }, status: { not: 'ANNULEE' } },
    });
    if (slotCount >= MAX_ORDERS_PER_SLOT) {
      return res.status(409).json({
        error: `Le créneau "${slot}" est complet pour aujourd'hui. Merci d'en choisir un autre.`,
        code: 'SLOT_FULL',
      });
    }

    // ---- Revalidation des prix côté serveur (jamais confiance au client) ----
    const menuItemIds = items.map((i) => i.dishId || i.menuItemId).filter(Boolean);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } });
    const menuItemMap = new Map(menuItems.map((d) => [d.id, d]));

    let total = 0;
    const itemsData = items.map((i) => {
      const ref = menuItemMap.get(i.dishId || i.menuItemId);
      const price = ref ? ref.price : i.price;
      const name = ref ? ref.name : i.name;
      const qty = Math.max(1, parseInt(i.qty, 10) || 1);
      total += price * qty;
      return { menuItemId: ref ? ref.id : null, name, price, qty };
    });

    // Position GPS optionnelle, capturée côté navigateur (Leaflet + géoloc HTML5).
    const addressRecord = await prisma.address.create({
      data: {
        fullAddress: address,
        zone,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
      },
    });

    const order = await prisma.order.create({
      data: {
        customerName,
        customerPhone,
        slot,
        notes: notes || null,
        total,
        status: 'ATTENTE',
        addressId: addressRecord.id,
        items: { create: itemsData },
      },
      include: { items: true, address: true },
    });

    sockets.broadcastNewOrder(serializeOrder(order));
    res.status(201).json(serializeOrder(order));
  });

  // GET /api/orders — réservé au gérant : liste des commandes, filtrable par statut
  router.get('/', requireAdmin, async (req, res) => {
    const { status } = req.query;
    const orders = await prisma.order.findMany({
      where: status && status !== 'tout' ? { status: status.toUpperCase() } : {},
      orderBy: { createdAt: 'desc' },
      include: { items: true, review: true, address: true },
    });

    const phones = [...new Set(orders.map((o) => o.customerPhone))];
    const counts = await Promise.all(
      phones.map((p) => prisma.order.count({ where: { customerPhone: p } }))
    );
    const countMap = Object.fromEntries(phones.map((p, i) => [p, counts[i]]));

    res.json(orders.map((o) => ({ ...serializeOrder(o), customerOrderCount: countMap[o.customerPhone] })));
  });

  // PATCH /api/orders/:id/status — réservé au gérant
  router.patch('/:id/status', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ['ATTENTE', 'PREPARATION', 'LIVRAISON', 'LIVREE', 'ANNULEE'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const order = await prisma.order.update({
      where: { id: parseInt(id, 10) },
      data: { status },
      include: { items: true, address: true },
    });

    sockets.broadcastOrderUpdate(serializeOrder(order));

    if (status === 'LIVRAISON' && !order.smsSent) {
      const result = await sendSms(
        order.customerPhone,
        `Aux Folies Gourmandes : votre commande #${order.id} est en route ! Total : ${order.total} TND (espèces à la livraison).`
      );
      if (result.sent) {
        await prisma.order.update({ where: { id: order.id }, data: { smsSent: true } });
      }
    }
    if (status === 'LIVREE') {
      console.log(`[review] Lien d'avis pour la commande #${order.id} : /?avis=${order.id}`);
    }

    res.json(serializeOrder(order));
  });

  // PATCH /api/orders/:id/seen — réservé au gérant
  router.patch('/:id/seen', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const order = await prisma.order.update({
      where: { id: parseInt(id, 10) },
      data: { seenByAdmin: true },
      include: { items: true, address: true },
    });
    res.json(serializeOrder(order));
  });

  return router;
}

// Aplati l'adresse imbriquée pour que le frontend n'ait rien à changer
// (il continue de lire order.address / order.zone / order.latitude...).
function serializeOrder(order) {
  const { address, ...rest } = order;
  return {
    ...rest,
    address: address ? address.fullAddress : null,
    zone: address ? address.zone : null,
    latitude: address ? address.latitude : null,
    longitude: address ? address.longitude : null,
  };
}

module.exports = { buildOrdersRouter };
