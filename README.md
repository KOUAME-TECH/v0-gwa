# GWA Platform

Marketplace agroalimentaire PWA — Côte d’Ivoire.

**Prod :** https://v0-gwa-mu.vercel.app  
**Repo :** https://github.com/MYSTERE-arch/v0-gwa

---

## Documentation = Notion (pas ce repo)

**Toute la doc produit / ops / décisions vit dans Notion — GWA OS.**

| | Lien |
|--|------|
| **HQ Groupe** | [🏢 GWA Group OS](https://app.notion.com/p/3b4a6d3a76b48117883cdd39d34acde7) |
| **Command Center** | [⚡ Dashboard](https://app.notion.com/p/3b4a6d3a76b48144bfd2e4f06e8cd7ae) |
| Org / Roles | [Org Chart](https://app.notion.com/p/7b176f77198f47c1ac61a4b643e7ca9c) |
| Décisions | [Décisions GWA](https://app.notion.com/p/cfcbd24df32e4556ae1d94246f842cd5) |
| Risks | [Risks & Compliance](https://app.notion.com/p/ef6a119a7de64cb58eaa043524442ca5) |
| Projects / SOP | [Operating Model](https://app.notion.com/p/3b4a6d3a76b481468ce9ca103464afc9) |
| Nouveau | [Je suis nouveau](https://app.notion.com/p/3b4a6d3a76b481a9a043dfd989252f30) |
| Investisseurs + Newsletter | [💼 Espace Investisseurs](https://app.notion.com/p/3b4a6d3a76b481daa065fa0e47bb8738) |

Ce dépôt ne contient **que du code** + ce README.  
Ne pas rajouter de dossier `docs/` : mettre à jour le **Dashboard Notion** en fin de session.

---

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js App Router, React, Tailwind, PWA |
| Backend | Route Handlers `app/api/*`, `lib/*`, middleware |
| Data | Supabase (Auth, Postgres, Realtime, Storage) |
| Infra | Vercel · Upstash Redis · OneSignal · Africa’s Talking · FeexPay · Gemini |

```
Frontend  →  app/**/page.tsx  ·  components/  ·  hooks/  ·  public/
Backend   →  app/api/**       ·  lib/**       ·  middleware.ts  ·  scripts/schema/
```

## Démarrage local

```bash
npm install --legacy-peer-deps
# Demander .env.local au lead (ne jamais committer de secrets)
npm run dev
npm test
```

## Arborescence

```
app/                 # Pages (UI) + app/api (HTTP)
components/          # UI
hooks/
lib/                 # Domaine métier serveur
public/              # PWA, workers
scripts/schema/      # Migrations SQL (001 → …)
tests/               # Vitest
README.md            # ← seul fichier documentation du repo
```

## Déploiement & SQL

- Push `main` → Vercel prod.
- Migrations : appliquer `scripts/schema/0XX_*.sql` dans l’ordre (SQL Editor Supabase). Toujours un **nouveau** fichier, ne pas réécrire l’historique.
- Install Vercel : `npm install --legacy-peer-deps` (`vercel.json`).
- Intégration GitHub Supabase : **Deploy to production = OFF** (les migrations ne sont pas dans `supabase/migrations/`).

## Ops urgents (détail dans Notion Dashboard)

1. `FEEXPAY_*` + webhook E2E  
2. `AT_SENDER_ID` (SMS ≠ OneSignal)  
3. Soft-launch seed contenu
