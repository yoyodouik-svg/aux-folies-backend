const { PrismaClient } = require('@prisma/client');

// Un seul client Prisma réutilisé partout (bonne pratique, évite
// d'épuiser les connexions à la base en développement avec nodemon).
const prisma = new PrismaClient();

module.exports = prisma;
