/**
 * Sauvegarde la base de données dans backend/backups/, avec un nom
 * horodaté. Fonctionne pour SQLite (par défaut). Pour PostgreSQL,
 * voir la note en bas du fichier.
 *
 * Utilisation manuelle :
 *   npm run backup
 *
 * Utilisation automatique (cron, tous les jours à 3h du matin) :
 *   0 3 * * * cd /chemin/vers/backend && npm run backup >> backups/backup.log 2>&1
 *
 * Sur un hébergeur (Render, Railway, etc.), utilisez plutôt leur
 * fonctionnalité native de "scheduled job" / "cron job" pour lancer
 * cette même commande.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function timestamp() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

function backupSqlite() {
  // DATABASE_URL="file:./dev.db" -> on retrouve le chemin du fichier
  const url = process.env.DATABASE_URL || '';
  const match = url.match(/^file:(.+)$/);
  if (!match) {
    console.error('DATABASE_URL ne correspond pas à un fichier SQLite ("file:./dev.db").');
    process.exit(1);
  }
  const dbPath = path.join(__dirname, '..', 'prisma', match[1].replace('./', ''));
  const destPath = path.join(BACKUP_DIR, `backup_${timestamp()}.db`);

  fs.copyFileSync(dbPath, destPath);
  console.log(`✔ Sauvegarde créée : ${destPath}`);

  // Ne garde que les 30 dernières sauvegardes pour ne pas saturer le disque
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('backup_') && f.endsWith('.db'))
    .sort();
  while (files.length > 30) {
    const oldest = files.shift();
    fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    console.log(`  (ancienne sauvegarde supprimée : ${oldest})`);
  }
}

const isPostgres = (process.env.DATABASE_URL || '').startsWith('postgres');

if (isPostgres) {
  console.log(`
Vous utilisez PostgreSQL : ce script ne gère que SQLite.
Pour PostgreSQL, utilisez plutôt "pg_dump" directement, par ex. :

  pg_dump "$DATABASE_URL" > backups/backup_$(date +%Y-%m-%d_%Hh%M).sql

La plupart des hébergeurs Postgres managés (Railway, Supabase, Render...)
proposent aussi des sauvegardes automatiques intégrées à activer dans
leur interface — à privilégier en production.
`);
  process.exit(0);
} else {
  backupSqlite();
}
