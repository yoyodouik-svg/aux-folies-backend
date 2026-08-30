require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Images HD réelles (Unsplash, licence gratuite — https://unsplash.com/license).
// Chaque URL a été vérifiée individuellement (une par une, aucune répétition).
// Recommandation production : téléchargez-les et servez-les depuis votre
// propre stockage (ex: Cloudinary, S3) pour ne pas dépendre de la
// disponibilité d'Unsplash sur votre site en ligne.
const IMG = {
  saladeTunisienne: 'https://images.unsplash.com/photo-1604497181015-76590d828b75?auto=format&fit=crop&w=800&q=80',
  brik: 'https://images.unsplash.com/photo-1515022376298-7333f33e704b?auto=format&fit=crop&w=800&q=80',
  mechouia: 'https://images.unsplash.com/photo-1604909052583-bb464043e050?auto=format&fit=crop&w=800&q=80',
  couscousAgneau: 'https://images.unsplash.com/photo-1778850790390-c1ba244fbc85?auto=format&fit=crop&w=800&q=80',
  ojjaMerguez: 'https://images.unsplash.com/photo-1682622110419-b671026a4536?auto=format&fit=crop&w=800&q=80',
  tajine: 'https://images.unsplash.com/photo-1520218576172-c1a2df3fa5fc?auto=format&fit=crop&w=800&q=80',
  ragout: 'https://images.unsplash.com/photo-1445979323117-80453f573b71?auto=format&fit=crop&w=800&q=80',
  brochettes: 'https://images.unsplash.com/photo-1705359573325-f2006d5e459f?auto=format&fit=crop&w=800&q=80',
  merguez: 'https://images.unsplash.com/photo-1575861158310-c7c6bec1c4cf?auto=format&fit=crop&w=800&q=80',
  kefta: 'https://images.unsplash.com/photo-1767974968707-db3d448d4ef3?auto=format&fit=crop&w=800&q=80',
  riz: 'https://images.unsplash.com/photo-1519996409144-56c88c9aa612?auto=format&fit=crop&w=800&q=80',
  frites: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
  makroudh: 'https://images.unsplash.com/photo-1624000937155-cb8a719eaf89?auto=format&fit=crop&w=800&q=80',
  zrir: 'https://images.unsplash.com/photo-1604850723811-35d9702ee794?auto=format&fit=crop&w=800&q=80',
  zgougou: 'https://images.unsplash.com/photo-1679941167941-0751af32fe15?auto=format&fit=crop&w=800&q=80',
};

const MENU_ITEMS = [
  { categoryKey: 'entrees', name: 'Salade Tunisienne', price: 8, tags: 'vegetarien', position: 1, imageUrl: IMG.saladeTunisienne,
    description: "Tomates, poivrons grillés, oignons et thon, à l'huile d'olive" },
  { categoryKey: 'entrees', name: "Brik à l'œuf et thon", price: 6, tags: '', position: 2, imageUrl: IMG.brik,
    description: "Feuille de brick croustillante, farcie à l'œuf et au thon" },
  { categoryKey: 'entrees', name: 'Salade Méchouia', price: 9, tags: 'vegetarien', position: 3, imageUrl: IMG.mechouia,
    description: "Poivrons et tomates grillés, ail, câpres et huile d'olive" },

  { categoryKey: 'plats', name: "Couscous à l'Agneau", price: 22, tags: 'populaire', position: 1, imageUrl: IMG.couscousAgneau,
    description: 'Couscous traditionnel mijoté avec légumes de saison et agneau' },
  { categoryKey: 'plats', name: 'Ojja Merguez', price: 16, tags: 'epice,populaire', position: 2, imageUrl: IMG.ojjaMerguez,
    description: 'Sauce tomate épicée, merguez et œufs, servie avec pain frais' },
  { categoryKey: 'plats', name: 'Tajine Malsouka', price: 14, tags: '', position: 3, imageUrl: IMG.tajine,
    description: 'Spécialité tunisienne aux œufs, fromage et viande hachée' },
  { categoryKey: 'plats', name: 'Marqa aux Fèves', price: 18, tags: '', position: 4, imageUrl: IMG.ragout,
    description: "Ragoût mijoté d'agneau et fèves fraîches" },

  { categoryKey: 'grillades', name: 'Brochettes de Poulet', price: 15, tags: 'populaire', position: 1, imageUrl: IMG.brochettes,
    description: 'Marinées aux épices, grillées au feu de bois' },
  { categoryKey: 'grillades', name: 'Merguez Grillée', price: 14, tags: 'epice', position: 2, imageUrl: IMG.merguez,
    description: 'Saucisses épicées tunisiennes grillées' },
  { categoryKey: 'grillades', name: "Kefta d'Agneau", price: 17, tags: 'epice', position: 3, imageUrl: IMG.kefta,
    description: "Boulettes d'agneau haché aux herbes, grillées" },

  { categoryKey: 'accompagnements', name: 'Riz Jerbien', price: 7, tags: 'vegetarien', position: 1, imageUrl: IMG.riz,
    description: 'Riz mijoté aux épices et légumes façon Jerba' },
  { categoryKey: 'accompagnements', name: 'Frites Maison', price: 5, tags: 'vegetarien,populaire', position: 2, imageUrl: IMG.frites,
    description: 'Pommes de terre fraîches coupées et frites maison' },

  { categoryKey: 'desserts', name: 'Makroudh', price: 6, tags: 'vegetarien,populaire', position: 1, imageUrl: IMG.makroudh,
    description: 'Gâteau de semoule fourré aux dattes, imbibé de miel' },
  { categoryKey: 'desserts', name: 'Zrir', price: 8, tags: 'vegetarien', position: 2, imageUrl: IMG.zrir,
    description: 'Douceur traditionnelle aux fruits secs et miel' },
  { categoryKey: 'desserts', name: 'Assida Zgougou', price: 7, tags: 'vegetarien,populaire', position: 3, imageUrl: IMG.zgougou,
    description: "Crème dessert aux pignons d'Alep, recette de fête" },
];

async function main() {
  console.log('→ Suppression des données existantes...');
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.menuItem.deleteMany();

  console.log('→ Insertion de la carte (avec photos)...');
  for (const item of MENU_ITEMS) {
    await prisma.menuItem.create({ data: item });
  }

  console.log('→ Initialisation du statut du restaurant (mode automatique)...');
  await prisma.restaurantStatus.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, isOpenManual: null },
  });

  const username = process.env.SEED_ADMIN_USERNAME || 'gerant';
  const password = process.env.SEED_ADMIN_PASSWORD || 'kram2026';
  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (!existingUser) {
    console.log(`→ Création du compte gérant "${username}"...`);
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { username, passwordHash, role: 'ADMIN' } });
  } else {
    console.log(`→ Compte gérant "${username}" déjà existant, inchangé.`);
  }

  console.log('✔ Seed terminé.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
