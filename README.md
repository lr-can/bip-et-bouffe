# Bip & Bouffe

Appliquette cuisine entre amis : recettes, planning multi-jours et liste de courses.

## Lancer (local)

```bash
npm install
npm run dev
```

L’API passe par les **Netlify Functions** (`/api/*`), émulées en local via `@netlify/vite-plugin`.

- App + API : http://localhost:5173

Variables : copier `.env.local.example` → `.env` (ou définir les secrets dans Netlify).

## Déploiement Netlify

Build : `npm run build` · Publish : `dist`  
Secrets à définir : `GG_client_email`, `GG_private_key`, `COOKING_SPREADSHEET_ID`  
`.env` est exclu du secrets scan (`SECRETS_SCAN_OMIT_PATHS` dans `netlify.toml`).
