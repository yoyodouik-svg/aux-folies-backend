const jwt = require('jsonwebtoken');

/**
 * Deux "canaux" Socket.io :
 *
 *  - namespace par défaut ("/")  -> public (le site client) : reçoit
 *    uniquement les changements de statut du restaurant (ouvert/fermé).
 *
 *  - namespace "/admin"          -> réservé au tableau de bord gérant,
 *    protégé par le même JWT que les routes REST. Reçoit les nouvelles
 *    commandes et les changements de statut de commande.
 */
function initSockets(io) {
  io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
  });

  const adminNamespace = io.of('/admin');

  adminNamespace.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentification requise.'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch (err) {
      next(new Error('Session invalide ou expirée.'));
    }
  });

  adminNamespace.on('connection', (socket) => {
    console.log(`[socket] Gérant connecté : ${socket.user.username}`);
    socket.on('disconnect', (reason) => {
      console.log(`[socket] Gérant déconnecté (${reason}) : ${socket.user.username}`);
    });
  });

  return {
    broadcastStatus(status) {
      io.emit('status:updated', status);
    },
    broadcastNewOrder(order) {
      adminNamespace.emit('order:new', order);
    },
    broadcastOrderUpdate(order) {
      adminNamespace.emit('order:updated', order);
    },
  };
}

module.exports = { initSockets };
