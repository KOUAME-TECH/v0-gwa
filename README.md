# GWA Platform

Marketplace agroalimentaire PWA — Côte d’Ivoire.  
**Prod :** https://v0-gwa-mu.vercel.app

## Nouveau dans l’équipe ?

**Commence ici → [`docs/onboarding-equipe.md`](docs/onboarding-equipe.md)**  
(carte du repo, où chercher, docs à lire, flux escrow / abo, checklist J1)

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js App Router, React, Tailwind, PWA |
| Backend | Route Handlers `app/api/*`, `lib/*`, middleware |
| Data | Supabase (Auth, Postgres, Realtime, Storage) |
| Infra | Vercel · Upstash Redis · OneSignal · Africa’s Talking · FeexPay · Gemini |

## Frontend vs Backend

```
Frontend  →  app/**/page.tsx  ·  components/  ·  hooks/  ·  public/
Backend   →  app/api/**       ·  lib/**       ·  middleware.ts  ·  scripts/schema/
```

- Architecture : [`docs/architecture.md`](docs/architecture.md)  
- Cahier des charges + roadmap 6/12/24 : [`docs/cahier-des-charges-actuel-evolution-6-12-24.md`](docs/cahier-des-charges-actuel-evolution-6-12-24.md)  
- Index docs : [`docs/README.md`](docs/README.md)  
- Logo : [`docs/brand.md`](docs/brand.md)

## Démarrage local

```bash
npm install --legacy-peer-deps
# Demander .env.local au lead (ne jamais committer de secrets)
npm run dev
npm test
```

Statut des routes : `lib/routes/inventory.ts` · UI locale `/dev/routes`.

## Arborescence utile

```
app/                 # Pages (UI) + app/api (HTTP backend)
components/          # UI par domaine
hooks/               # Hooks client
lib/                 # Domaine métier serveur (pricing, orders, feexpay, scg…)
public/              # Logo, PWA, service workers
scripts/schema/      # Migrations SQL (ordre 001 → …)
docs/                # Onboarding, CdC, décisions, ops
tests/               # Vitest
```

## Déploiement

Push sur `main` → Vercel (prod).  
Install : `npm install --legacy-peer-deps` (`vercel.json`).

## Migrations SQL

Appliquer dans l’ordre `scripts/schema/0XX_*.sql` (SQL Editor Supabase).  
Ne pas réécrire l’historique : toujours un **nouveau** fichier.
