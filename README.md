# Aux Folies Gourmandes — Backend

Serveur Express + Prisma + Socket.io : carte, commandes, statut du
restaurant, avec mise à jour en temps réel entre le site client et le
tableau de bord gérant.

## Démarrage rapide (SQLite, zéro configuration)

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Le serveur écoute par défaut sur `http://localhost:4000`.
Vérifiez qu'il tourne bien en ouvrant **http://localhost:4000/api/health**
dans un navigateur : vous devez voir `{"ok":true, ...}`.

Compte gérant créé automatiquement par le seed :
- **Identifiant :** `gerant`
- **Mot de passe :** `kram2026`
👉 à changer dès la première connexion en production.

## 🩺 Diagnostic des 3 erreurs les plus fréquentes

**1. `Uncaught ReferenceError: io is not defined`**
Le script Socket.io (CDN) n'a pas pu se charger avant le script du site.
Le fichier HTML fourni charge désormais Socket.io et Leaflet avec un
système de secours à deux CDN (cdnjs puis fallback), et le code vérifie
`typeof io !== 'undefined'` avant de l'utiliser : si les CDN sont
bloqués (pare-feu, contenu bloqué), le site affiche un message clair au
lieu de planter, et continue de fonctionner sans le temps réel.

**2. `[menu] échec de chargement : Impossible de contacter le serveur`**
Cette erreur veut dire que le navigateur n'a reçu AUCUNE réponse du
backend (différent d'une erreur 404/500, qui elle veut dire que le
serveur répond mais refuse la requête). Causes possibles, dans l'ordre
de fréquence :
- Le serveur n'est pas démarré (`npm run dev` doit tourner et ne pas
  avoir planté — regardez le terminal).
- **Vous testez le fichier HTML dans l'aperçu intégré du chat Claude.ai**.
  Cet aperçu tourne dans un environnement isolé qui ne peut PAS
  atteindre le `localhost` de votre propre ordinateur. Il faut ouvrir
  le fichier HTML téléchargé directement dans un vrai navigateur
  (double-clic dessus, ou `npx serve` dans son dossier), pendant que
  le backend tourne sur votre machine.
- `API_BASE` en haut du `<script>` du site ne pointe pas sur le bon
  port (par défaut `http://localhost:4000`).

**3. `[status] indisponible : Impossible de contacter le serveur` / échec
de reconnexion WebSocket**
M�me cause que le point 2 la plupart du temps (serveur non joignable).
Si le serveur tourne bien et que l'erreur persiste, vérifiez le CORS :
`CLIENT_ORIGIN` dans `.env` doit correspondre à l'origine réelle de
votre site. Par défaut (`CLIENT_ORIGIN=*`), toutes les origines sont
acceptées, y compris les fichiers ouverts en local (`Origin: null`).
En production, mettez la vraie URL de votre site, par ex :
`CLIENT_ORIGIN=https://auxfoliesgourmandes.tn`

## Passer sur PostgreSQL (production)

1. `.env` : remplacez `DATABASE_URL` par votre URL Postgres.
2. `prisma/schema.prisma` : `provider = "postgresql"`.
3. `npx prisma migrate dev --name init`.

## Modèles de données

`User` (comptes gérant) · `MenuItem` (plats, avec `imageUrl`) ·
`Address` (adresse + position GPS, une par commande) · `Order` ·
`OrderItem` · `Review` · `RestaurantStatus`.

## Endpoints REST

| Méthode | Route                        | Accès   | Description                            |
|---------|-------------------------------|---------|------------------------------------------|
| GET     | /api/health                  | public  | Vérifier que le serveur répond            |
| GET     | /api/menu                    | public  | Carte des plats actifs, groupée           |
| GET     | /api/menu/admin              | gérant  | Tous les plats, y compris désactivés      |
| POST    | /api/menu                    | gérant  | Ajouter un plat                           |
| PATCH   | /api/menu/:id                | gérant  | Modifier un plat (prix, image, dispo...)  |
| DELETE  | /api/menu/:id                | gérant  | Retirer un plat                           |
| POST    | /api/orders                  | public  | Passer une commande                       |
| GET     | /api/orders/lookup?phone=... | public  | Pré-remplissage adresse client connu      |
| GET     | /api/orders/slot-availability| public  | Places restantes par créneau              |
| GET     | /api/orders?status=...       | gérant  | Lister les commandes                      |
| PATCH   | /api/orders/:id/status       | gérant  | Changer le statut d'une commande          |
| PATCH   | /api/orders/:id/seen         | gérant  | Marquer une commande comme vue            |
| GET     | /api/status                  | public  | Cuisine ouverte/fermée                    |
| PATCH   | /api/status                  | gérant  | Forcer l'ouverture/fermeture (ou auto)    |
| GET     | /api/geocode/search?q=...    | public  | Auto-complétion d'adresse (Nominatim)     |
| GET     | /api/geocode/reverse?lat&lon | public  | Adresse à partir d'une position GPS       |
| POST    | /api/admin/login             | public  | Connexion gérant → JWT                    |

## Temps réel (Socket.io)

- Namespace **`/`** (public) : `status:updated`.
- Namespace **`/admin`** (JWT requis dans `socket.handshake.auth.token`) :
  `order:new`, `order:updated`.

Le serveur accepte le repli automatique WebSocket → HTTP polling
(`transports: ['websocket', 'polling']`) si des WebSockets natifs sont
bloqués par un proxy réseau.

## Sauvegardes

```bash
npm run backup
```
Voir `scripts/backup.js` pour la version SQLite et l'équivalent
`pg_dump` pour PostgreSQL.
