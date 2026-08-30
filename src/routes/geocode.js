const express = require('express');

/**
 * Proxy vers Nominatim (OpenStreetMap), pour deux raisons :
 *
 *  1. La politique d'usage de Nominatim (https://operations.osmfoundation.org/policies/nominatim/)
 *     impose un User-Agent identifiant clairement l'application et un
 *     maximum d'1 requête/seconde. En passant par notre backend, on
 *     applique cette règle une seule fois, proprement, plutôt que de
 *     compter sur chaque navigateur client pour bien se comporter.
 *  2. Un petit cache mémoire évite de renvoyer deux fois la même requête
 *     à Nominatim (ex : plusieurs clients qui tapent "Le Kram").
 *
 * ⚠️ Nominatim est un service gratuit à usage raisonnable. Pour un site
 * à fort trafic en production, prévoyez soit votre propre instance
 * Nominatim, soit un fournisseur payant (ex: Mapbox, LocationIQ) si le
 * volume de recherches d'adresses devient important.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const CONTACT_EMAIL = process.env.NOMINATIM_CONTACT_EMAIL || 'contact@example.com';
const USER_AGENT = `AuxFoliesGourmandes/1.0 (${CONTACT_EMAIL})`;

// ---- Cache mémoire très simple (clé -> { data, expiresAt }) ----
const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}
function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---- File d'attente simple pour respecter la limite d'1 req/sec de Nominatim ----
let lastRequestAt = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastRequestAt)); // marge de sécurité (1.1s)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function nominatimFetch(url) {
  await throttle();
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fr' },
  });
  if (!response.ok) {
    throw new Error(`Nominatim a répondu ${response.status}`);
  }
  return response.json();
}

function buildRouter() {
  const router = express.Router();

  // GET /api/geocode/search?q=avenue+habib+bourguiba
  // Recherche d'adresses (auto-complétion), limité à la Tunisie.
  router.get('/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 3) return res.json([]); // évite de spammer Nominatim pour 1-2 lettres

    const cacheKey = `search:${q.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
      const url = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&limit=5&countrycodes=tn&q=${encodeURIComponent(q)}`;
      const results = await nominatimFetch(url);
      const simplified = results.map((r) => ({
        displayName: r.display_name,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
      }));
      setCached(cacheKey, simplified);
      res.json(simplified);
    } catch (err) {
      console.error('[geocode/search]', err.message);
      res.status(502).json({ error: 'Service de recherche d\'adresse indisponible pour le moment.' });
    }
  });

  // GET /api/geocode/reverse?lat=36.85&lon=10.32
  // Géocodage inverse : convertit une position GPS en adresse lisible.
  router.get('/reverse', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat et lon requis.' });

    const cacheKey = `reverse:${lat},${lon}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
      const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
      const result = await nominatimFetch(url);
      const simplified = {
        displayName: result.display_name || '',
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
      };
      setCached(cacheKey, simplified);
      res.json(simplified);
    } catch (err) {
      console.error('[geocode/reverse]', err.message);
      res.status(502).json({ error: 'Service de géolocalisation indisponible pour le moment.' });
    }
  });

  return router;
}

module.exports = { buildGeocodeRouter: buildRouter };
