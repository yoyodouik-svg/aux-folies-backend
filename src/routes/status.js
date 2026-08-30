const express = require('express');
const prisma = require('../prismaClient');
const { requireAdmin } = require('../middleware/auth');

/**
 * Calcule si la cuisine est ouverte selon les horaires réels,
 * utilisé quand aucun forçage manuel n'est actif (isOpenManual === null).
 */
function isWithinOpeningHours(date = new Date()) {
  const day = date.getDay(); // 0 = dimanche ... 6 = samedi
  const hour = date.getHours() + date.getMinutes() / 60;
  let open, close;
  if (day === 0) { open = 10; close = 21; }        // dimanche
  else if (day === 6) { open = 9; close = 22; }    // samedi
  else { open = 9; close = 21; }                   // lundi-vendredi
  return hour >= open && hour < close;
}

function buildStatusRouter(sockets) {
  const router = express.Router();

  async function getOrCreateStatusRow() {
    let row = await prisma.restaurantStatus.findUnique({ where: { id: 1 } });
    if (!row) {
      row = await prisma.restaurantStatus.create({ data: { id: 1, isOpenManual: null } });
    }
    return row;
  }

  function computeIsOpen(row) {
    return row.isOpenManual !== null ? row.isOpenManual : isWithinOpeningHours();
  }

  // GET /api/status — public
  router.get('/', async (req, res) => {
    const row = await getOrCreateStatusRow();
    res.json({ isOpen: computeIsOpen(row), manual: row.isOpenManual });
  });

  // PATCH /api/status — réservé au gérant : { isOpenManual: true | false | null }
  // null remet le mode automatique (basé sur les horaires).
  router.patch('/', requireAdmin, async (req, res) => {
    const { isOpenManual } = req.body;
    const row = await prisma.restaurantStatus.upsert({
      where: { id: 1 },
      update: { isOpenManual },
      create: { id: 1, isOpenManual },
    });
    const payload = { isOpen: computeIsOpen(row), manual: row.isOpenManual };
    sockets.broadcastStatus(payload);
    res.json(payload);
  });

  return router;
}

module.exports = { buildStatusRouter };
