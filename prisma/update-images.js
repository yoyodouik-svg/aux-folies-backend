/**
 * Met à jour UNIQUEMENT les photos des plats déjà en base, sans jamais
 * toucher aux commandes, adresses ou comptes existants.
 *
 * Contrairement à `npm run seed` (qui vide et recrée toute la carte —
 * dangereux une fois que le site a de vraies commandes en production),
 * ce script fait une mise à jour ciblée par nom de plat.
 *
 * Utilisation :
 *   node prisma/update-images.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Doit rester synchronisé avec les noms de plats existants dans votre base.
const IMAGE_BY_NAME = {
  'Salade Tunisienne': 'https://images.unsplash.com/photo-1604497181015-76590d828b75?auto=format&fit=crop&w=800&q=80',
  "Brik à l'œuf et thon": 'https://images.unsplash.com/photo-1515022376298-7333f33e704b?auto=format&fit=crop&w=800&q=80',
  'Salade Méchouia': 'https://images.unsplash.com/photo-1604909052583-bb464043e050?auto=format&fit=crop&w=800&q=80',
  "Couscous à l'Agneau": 'https://images.unsplash.com/photo-1778850790390-c1ba244fbc85?auto=format&fit=crop&w=800&q=80',
  'Ojja Merguez': 'https://images.unsplash.com/photo-1682622110419-b671026a4536?auto=format&fit=crop&w=800&q=80',
  'Tajine Malsouka': 'https://images.unsplash.com/photo-1520218576172-c1a2df3fa5fc?auto=format&fit=crop&w=800&q=80',
  'Marqa aux Fèves': 'https://images.unsplash.com/photo-1445979323117-80453f573b71?auto=format&fit=crop&w=800&q=80',
  'Brochettes de Poulet': 'https://images.unsplash.com/photo-1705359573325-f2006d5e459f?auto=format&fit=crop&w=800&q=80',
  'Merguez Grillée': 'https://images.unsplash.com/photo-1575861158310-c7c6bec1c4cf?auto=format&fit=crop&w=800&q=80',
  "Kefta d'Agneau": 'https://images.unsplash.com/photo-1767974968707-db3d448d4ef3?auto=format&fit=crop&w=800&q=80',
  'Riz Jerbien': 'https://images.unsplash.com/photo-1519996409144-56c88c9aa612?auto=format&fit=crop&w=800&q=80',
  'Frites Maison': 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
  'Makroudh': 'https://images.unsplash.com/photo-1624000937155-cb8a719eaf89?auto=format&fit=crop&w=800&q=80',
  'Zrir': 'https://images.unsplash.com/photo-1604850723811-35d9702ee794?auto=format&fit=crop&w=800&q=80',
  'Assida Zgougou': 'https://images.unsplash.com/photo-1679941167941-0751af32fe15?auto=format&fit=crop&w=800&q=80',
};

async function main() {
  let updated = 0;
  let notFound = [];

  for (const [name, imageUrl] of Object.entries(IMAGE_BY_NAME)) {
    const result = await prisma.menuItem.updateMany({
      where: { name },
      data: { imageUrl },
    });
    if (result.count > 0) {
      updated += result.count;
      console.log(`✔ ${name}`);
    } else {
      notFound.push(name);
    }
  }

  console.log(`\n${updated} plat(s) mis à jour.`);
  if (notFound.length > 0) {
    console.log(`⚠ Aucun plat trouvé avec ce nom exact (vérifiez l'orthographe en base) :`);
    notFound.forEach((n) => console.log(`  - ${n}`));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
