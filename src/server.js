require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { initSockets } = require('./sockets');
const authRouter = require('./routes/auth');
const menuRouter = require('./routes/menu');
const { buildOrdersRouter } = require('./routes/orders');
const { buildStatusRouter } = require('./routes/status');
const { buildGeocodeRouter } = require('./routes/geocode');

const app = express();
const server = http.createServer(app);

/**
 * ============================================================
 * CORS — configuration robuste
 * ============================================================
 * Cause fréquente des erreurs "impossible de contacter le serveur" /
 * échecs de reconnexion WebSocket : une origine CORS mal configurée.
 *
 * Ici, on accepte explicitement les origines listées dans
 * CLIENT_ORIGIN (séparées par des virgules si plusieurs), PLUS les cas
 * particuliers où le frontend n'a pas d'origine HTTP standard :
 *   - fichier HTML ouvert directement dans le navigateur (file://)
 *     → le navigateur envoie alors "Origin: null"
 *   - outils de test (Postman, curl) → pas de header Origin du tout
 *
 * Si CLIENT_ORIGIN vaut "*" (valeur par défaut), on autorise tout le
 * monde : pratique en développement, à restreindre en production en
 * mettant la vraie URL de votre site dans .env.
 */
const allowedOrigins = (process.env.CLIENT_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (allowedOrigins.includes('*')) return true;
  if (!origin) return true;          // requêtes sans header Origin (curl, Postman, apps mobiles)
  if (origin === 'null') return true; // fichier HTML ouvert en local (file://)
  return allowedOrigins.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) callback(null, true);
    else callback(new Error(`Origine non autorisée par CORS : ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) callback(null, true);
      else callback(new Error(`Origine non autorisée par CORS (WebSocket) : ${origin}`));
    },
    methods: ['GET', 'POST'],
  },
  // Autorise le repli sur le "polling" HTTP si les WebSockets natifs
  // sont bloqués par un proxy/pare-feu — évite un échec sec de connexion.
  transports: ['websocket', 'polling'],
});

// ---- Middlewares ----
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // répond explicitement aux requêtes preflight OPTIONS
app.use(express.json());

// ---- Sockets ----
const sockets = initSockets(io);

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/admin', authRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', buildOrdersRouter(sockets));
app.use('/api/status', buildStatusRouter(sockets));
app.use('/api/geocode', buildGeocodeRouter());

// ---- 404 explicite (plutôt qu'un silence qui ressemble à un serveur éteint) ----
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route inconnue : ${req.method} ${req.originalUrl}` });
});

// ---- Gestion d'erreurs générique (y compris erreurs CORS) ----
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith('Origine non autorisée')) {
    console.warn(`[cors] ${err.message}`);
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ✔ Aux Folies Gourmandes — backend démarré');
  console.log(`  → API      : http://localhost:${PORT}/api/health`);
  console.log(`  → CORS     : ${allowedOrigins.includes('*') ? 'toutes origines autorisées (dev)' : allowedOrigins.join(', ')}`);
  console.log('');
  console.log('  ⚠ Si le frontend affiche "impossible de contacter le serveur" :');
  console.log('    1. Vérifiez que ce message reste affiché ici (le serveur tourne).');
  console.log('    2. Ouvrez http://localhost:' + PORT + '/api/health dans un navigateur : doit répondre {"ok":true}.');
  console.log('    3. Le fichier HTML doit être ouvert EN DEHORS de l\'aperçu intégré de Claude.ai');
  console.log('       (double-cliquez sur le fichier téléchargé, ou servez-le avec un serveur local)');
  console.log('       car l\'aperçu en iframe du chat ne peut pas atteindre votre "localhost".');
  console.log('    4. Vérifiez que API_BASE en haut du <script> du site pointe bien sur ce port.');
  console.log('');
});
