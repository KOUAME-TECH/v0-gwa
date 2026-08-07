# GWA Platform

Business Unit de **KOUAME Corporation** — marketplace agroalimentaire PWA (Côte d’Ivoire).

**Prod :** https://v0-gwa-mu.vercel.app  
**Repo :** https://github.com/MYSTERE-arch/v0-gwa

---

## Documentation = Notion

| | Lien |
|--|------|
| **Holding** | [KOUAME Corporation](https://app.notion.com/p/311a6d3a76b481118d65ed7bd5744798) |
| **BU GWA** | [GWA — Business Unit](https://app.notion.com/p/311a6d3a76b481498c21f0dd3f54d1ad) |
| **Ops / Dashboard** | [Operations](https://app.notion.com/p/3b4a6d3a76b48117883cdd39d34acde7) · [Dashboard](https://app.notion.com/p/3b4a6d3a76b48144bfd2e4f06e8cd7ae) |
| **Relations** (CRM, packs, accès) | [Relations](https://app.notion.com/p/3b5a6d3a76b481d28ecfcc7c3c4aff2f) |
| Pack Investisseurs (partageable) | [Pack — Investisseurs](https://app.notion.com/p/3b5a6d3a76b48126b1f3dc1cfd56689f) |

Ce dépôt = **code uniquement** + ce README. Pas de dossier `docs/`.

---

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js App Router, React, Tailwind, PWA |
| Backend | Route Handlers `app/api/*`, `lib/*`, middleware |
| Data | Supabase (Auth, Postgres, Realtime, Storage) |
| Infra | Vercel · Upstash Redis · OneSignal · Africa’s Talking · FeexPay · Gemini |

## Démarrage local

```bash
npm install --legacy-peer-deps
# Demander .env.local au lead (ne jamais committer de secrets)
npm run dev
npm test
```

## Déploiement & SQL

- Push `main` → Vercel prod.
- Migrations : `scripts/schema/0XX_*.sql` dans l’ordre (SQL Editor Supabase).
- GitHub Supabase Deploy = **OFF**.

## Ops urgents

1. `FEEXPAY_*` + webhook E2E  
2. `AT_SENDER_ID` (SMS ≠ OneSignal)  
3. Soft-launch seed contenu
