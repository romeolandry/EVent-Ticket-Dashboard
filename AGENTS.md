# Event Ticket Plus — Dashboard

Application Vue 3 + Composition API + TypeScript + Pinia (Vite) pour visualiser
les participants d'événements issus d'un site WordPress (The Events Calendar /
Event Tickets Plus).

## Commandes

- `npm run dev` : serveur de développement
- `npm run test:unit -- run` : tests Vitest
- `npm run lint` : oxlint + eslint (avec --fix)
- `npm run build` : type-check (vue-tsc) + build Vite
- `npm run format` : Prettier

## Configuration

- Copier `.env.example` en `.env` et renseigner `VITE_WP_API_URL`
  (URL du site WordPress, sans slash final).
- Authentification Basic optionnelle : `VITE_WP_AUTH_USER` et
  `VITE_WP_AUTH_PASSWORD` (mot de passe applicatif WordPress). Si définis,
  un en-tête `Authorization: Basic …` est ajouté à chaque requête API.
- API consommées : `/wp-json/tribe/events/v1/events` et
  `/wp-json/tribe/tickets/v1/attendees?event=<id>`.

## Internationalisation

- vue-i18n (composition, `legacy: false`). Locales : `fr` (défaut), `en`, `de`
  dans `src/i18n/` ; `fr.ts` est la référence (`satisfies typeof fr` dans les
  autres). Locale persistée dans `localStorage` (`etp-locale`). Les tests qui
  montent des composants utilisent `createTestI18n()` de `src/test/i18n.ts`.

## Comportements métier

- Thème clair uniquement (les styles utilisent les variables `--color-*` de
  `src/assets/base.css`, pas de media query sombre).
- Le dashboard n'affiche que les événements publics et actifs (`fetchEvents` :
  `status` = publish et `end_date`/`start_date` >= aujourd'hui). Un
  participant n'est affiché que si son événement est public et actif.
- Le endpoint attendees **ignore totalement le paramètre `event=`** (même
  réponse quelle que soit la valeur sur wach-auf.com) : `fetchAttendees`
  récupère toutes les pages et filtre côté client sur `post_id` (= id de
  l'événement propriétaire). Le endpoint tickets ignore aussi `event=`.
- Check-in/out : `PATCH /wp-json/tribe/tickets/v1/attendees/{id}` avec le
  paramètre **`check_in`** (et non `checked_in`, qui est en lecture seule).
- Groupes de travail : pas de champ WP — assignations persistées en
  localStorage (`etp-groups:<eventId>`). Impression du badge possible
  uniquement si le participant est checké ET a un groupe. Config badge en
  localStorage (`etp-badge-config`).

## Déploiement (Docker)

- `docker compose up` (lit le `.env` local, jamais inclus dans l'image) ou
  `docker build -t event-ticket-plus-dashboard .` + `docker run -p 8080:8080
  -e VITE_WP_API_URL=… -e SUPERUSER_EMAIL=… …`
- Le runtime est un serveur Node (`server/index.mjs`) : SPA statique +
  `/api/auth` (login par email) + `/api/access-list` (superuser) +
  `/config.js` dynamique.
- Authentification : liste des emails autorisés dans
  `/data/allowed-emails.json` (volume, inaccessible via HTTP) ; le superuser
  vient de `SUPERUSER_EMAIL`. Logique pure testable : `server/accessList.mjs`.
  Sessions : tokens en mémoire (12 h) — redémarrage du conteneur = re-login.
- **Proxy WP** : le front n'a aucun identifiant WordPress — il appelle
  `/wp-api/*` avec le token de session ; le serveur ajoute le Basic auth
  (`WP_AUTH_*` / `VITE_WP_*` en env) et relaie `GET`/`PATCH`.
- En dev, `/api` et `/wp-api` sont proxifiés vers `localhost:8890` (lancer :
  `DATA_DIR=/tmp/etp-data SUPERUSER_EMAIL=… WP_API_URL=… WP_AUTH_USER=…
  WP_AUTH_PASSWORD=… PORT=8890 node server/index.mjs`).

## Spécificités de l'environnement

- IPv6 cassée vers registry.npmjs.org : préfixer les commandes npm avec
  `NODE_OPTIONS=--dns-result-order=ipv4first`.
- npm 10.9.8 échoue avec « edgesOut » sur ce projet :
  utiliser `npm install --legacy-peer-deps`.
