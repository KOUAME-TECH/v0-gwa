# GWA Platform

Marketplace agroalimentaire PWA (Next.js) — Côte d’Ivoire.  
Prod : [https://v0-gwa-mu.vercel.app](https://v0-gwa-mu.vercel.app)

## Stack

- **Next.js 16** (App Router) + React 19
- **Supabase** (Auth, Postgres, Realtime, Storage)
- **Vercel** (hébergement)
- **Upstash Redis** (rate-limit / OTP store)
- **OneSignal** (push PWA)
- **AgentMail** (contact)
- **Africa’s Talking** (SMS OTP)

## Démarrage local

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # renseigner les clés
npm run dev
```

Variables : voir `.env.example`.  
Statut des routes : `lib/routes/inventory.ts` ou `/dev/routes` en local.

## Architecture

Voir [`docs/architecture.md`](docs/architecture.md) et [`docs/scope-beta.md`](docs/scope-beta.md) (lock F1–F6).

| Dossier | Rôle |
|---------|------|
| `app/` | Pages + API Routes (App Router) |
| `components/` | UI réutilisable (auth, chat, PWA, scg, ui) |
| `lib/auth` | OTP, téléphone, SMS |
| `lib/scg` | Moteur score de confiance |
| `lib/supabase` | Clients browser / server / admin |
| `lib/security` | Rate-limit, validation |
| `lib/email` | AgentMail |
| `lib/notifications` | Push OneSignal |
| `lib/routes` | Inventaire de statut des routes |
| `scripts/schema` | Migrations SQL (ordre numérique) |
| `scripts/ops` | Admin / checks |
| `scripts/demo` | Seed démo (jamais en prod sans intention) |

## Déploiement

Push sur la branche suivie par Vercel (`v0-gwa`).  
Install command Vercel : `npm install --legacy-peer-deps` (voir `vercel.json`).

## Scripts SQL

Appliquer dans l’ordre sous `scripts/schema/` via le SQL Editor Supabase.  
Ops et démo : `scripts/ops/`, `scripts/demo/`.
