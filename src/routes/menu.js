const express = require('express');
const prisma = require('../prismaClient');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/menu — public, uniquement les plats actifs, groupés par catégorie
router.get('/', async (req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { active: true },
    orderBy: [{ categoryKey: 'asc' }, { position: 'asc' }],
  });

  const grouped = {};
  items.forEach((d) => {
    if (!grouped[d.categoryKey]) grouped[d.categoryKey] = [];
    grouped[d.categoryKey].push({
      ...d,
      tags: d.tags ? d.tags.split(',').filter(Boolean) : [],
    });
  });

  res.json(grouped);
});

// ---- Gestion (réservée au gérant) ----

// GET /api/menu/admin — TOUS les plats, y compris désactivés (rupture de stock)
router.get('/admin', requireAdmin, async (req, res) => {
  const items = await prisma.menuItem.findMany({
    orderBy: [{ categoryKey: 'asc' }, { position: 'asc' }],
  });
  res.json(items.map((d) => ({ ...d, tags: d.tags ? d.tags.split(',').filter(Boolean) : [] })));
});

// POST /api/menu — créer un plat
router.post('/', requireAdmin, async (req, res) => {
  const { categoryKey, name, description, price, imageUrl, tags, position } = req.body;
  if (!categoryKey || !name || price == null) {
    return res.status(400).json({ error: 'categoryKey, name et price sont requis.' });
  }
  const item = await prisma.menuItem.create({
    data: {
      categoryKey,
      name,
      description: description || '',
      price: parseFloat(price),
      imageUrl: imageUrl || null,
      tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
      position: position || 0,
    },
  });
  res.status(201).json(item);
});

// PATCH /api/menu/:id — modifier un plat (prix, dispo, image...)
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, imageUrl, tags, active, position } = req.body;

  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags.join(',') : tags }),
      ...(active !== undefined && { active }),
      ...(position !== undefined && { position }),
    },
  });
  res.json(item);
});

// DELETE /api/menu/:id — retirer un plat
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  await prisma.menuItem.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
