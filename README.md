# GWA Platform

Marketplace agroalimentaire PWA — Côte d’Ivoire.  
**Prod :** https://v0-gwa-mu.vercel.app

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js App Router, React, Tailwind, PWA |
| Backend | Route Handlers `app/api/*`, `lib/*`, middleware |
| Data | Supabase (Auth, Postgres, Realtime, Storage) |
| Infra | Vercel · Upstash Redis · OneSignal · Africa’s Talking |

## Frontend vs Backend

```
Frontend  →  app/**/page.tsx  ·  components/  ·  hooks/  ·  public/
Backend   →  app/api/**       ·  lib/**       ·  middleware.ts  ·  scripts/schema/
```

Détail : **[`docs/architecture.md`](docs/architecture.md)**  
Logo GWA : **[`docs/brand.md`](docs/brand.md)** → fichiers dans `public/icon*.{svg,png}`

## Démarrage local

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # renseigner les clés
npm run dev
```

Statut des routes : `lib/routes/inventory.ts` · UI locale `/dev/routes`.

## Arborescence utile

```
app/                 # Pages (UI) + app/api (HTTP backend)
components/          # UI par domaine (auth, chat, brand, orders…)
hooks/               # Hooks client
lib/                 # Domaine métier serveur (auth, orders, scg…)
public/              # Logo, PWA, service workers
scripts/schema/      # Migrations SQL (ordre 001 → …)
scripts/ops/         # Bootstrap admin / checks
scripts/demo/        # Seed démo (jamais en prod sans intention)
docs/                # Architecture, ops, brand
tests/               # Vitest
```

## Déploiement

Push sur `main` → Vercel (prod).  
Install : `npm install --legacy-peer-deps` (`vercel.json`).

## Migrations SQL

Appliquer dans l’ordre `scripts/schema/0XX_*.sql` (SQL Editor Supabase ou MCP).  
Ne pas réécrire l’historique : toujours un nouveau fichier.
