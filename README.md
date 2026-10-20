# GWA Platform

Business Unit de **KOUAME Corporation** — marketplace agroalimentaire PWA (Côte d’Ivoire).

**Tech Lead GWA :** Makan Diabaté (pilotage quotidien — prise en main)  
**DG / supervision :** Yao Kouamé (vérification ponctuelle)

**Prod :** https://v0-gwa-mu.vercel.app  
**Repo :** https://github.com/MYSTERE-arch/v0-gwa

---

## Documentation = Notion

| | Lien |
|--|------|
| **Holding** | [KOUAME Corporation](https://app.notion.com/p/311a6d3a76b481118d65ed7bd5744798) |
| **BU GWA** | [GWA — Business Unit](https://app.notion.com/p/311a6d3a76b481498c21f0dd3f54d1ad) |
| **Équipe** (depts, membres) | [Équipe](https://app.notion.com/p/3b5a6d3a76b4811b82dbd4f46a9eb888) · [Je démarre ici](https://app.notion.com/p/3b5a6d3a76b4814699f7eae8ead6829b) |
| **Ops / Dashboard** | [Operations](https://app.notion.com/p/3b4a6d3a76b48117883cdd39d34acde7) · [Dashboard](https://app.notion.com/p/3b4a6d3a76b48144bfd2e4f06e8cd7ae) |
| **Relations** (CRM, packs, accès) | [Relations](https://app.notion.com/p/3b5a6d3a76b481d28ecfcc7c3c4aff2f) · [Accès](https://app.notion.com/p/3b5a6d3a76b481b59894efbebac19cf7) |
| Pack Investisseurs (partageable) | [Pack — Investisseurs](https://app.notion.com/p/3b5a6d3a76b48126b1f3dc1cfd56689f) |

### Accès équipe (rappel)

- Head → **Can edit** uniquement sur **sa** page Département (Membres + Travail).
- Stagiaire / nouveau → **Can view** sur son département + [Je démarre ici](https://app.notion.com/p/3b5a6d3a76b4814699f7eae8ead6829b).
- Ne pas partager Operations secrètes, CRM, ni les autres départements.

Ce dépôt = **code uniquement** + ce README. Pas de dossier `docs/`.

---

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js App Router, React, Tailwind, PWA |
| Backend | Route Handlers `app/api/*`, `lib/*`, middleware |
| Data | Supabase (Auth, Postgres, Realtime, Storage) |
| Infra | Vercel · Upstash Redis · OneSignal · Africa’s Talking · GeniusPay · Gemini |

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

1. `GENIUSPAY_API_KEY` + `GENIUSPAY_API_SECRET` (serveur uniquement)  
2. OTP téléphone : fournisseur SMS live, expéditeur approuvé, Redis persistant et `OTP_PEPPER`  
3. Soft-launch seed contenu

Le paiement est confirmé par vérification serveur de la référence GeniusPay après retour du checkout. Ne configurez pas encore le webhook GeniusPay : le format complet de signature et la fenêtre anti-rejeu doivent être confirmés dans la documentation officielle. Les versements vendeurs restent en traitement ops tant que l’API de payout n’est pas spécifiée.
