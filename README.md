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
- Migrations : `scripts/schema/0XX_*.sql` dans l’ordre (SQL Editor Supabase), notamment 058–062 avant déploiement de ces changements.
- GitHub Supabase Deploy = **OFF**.

## Ops urgents

1. GeniusPay : `GENIUSPAY_MODE` (`sandbox` ou `live`) et, pour chaque mode utilisé, `GENIUSPAY_API_KEY_<MODE>`, `GENIUSPAY_API_SECRET_<MODE>` et `GENIUSPAY_WEBHOOK_SECRET_<MODE>` (serveur uniquement)
2. OTP téléphone : fournisseur SMS live, expéditeur approuvé, Redis persistant et `OTP_PEPPER`
3. Contenu de lancement provenant uniquement de sources réelles et autorisées ; aucune donnée de démonstration en production

Le pay-in GeniusPay utilise les headers serveur `X-API-Key` et `X-API-Secret`, puis redirige vers le checkout hébergé. La confirmation s'appuie sur le statut documenté `completed`, vérifié côté serveur avec la référence, le montant, la devise et les métadonnées de commande. Le webhook `/api/webhooks/geniuspay` vérifie HMAC-SHA256 sur `timestamp + "." + JSON.stringify(payload)` après parsing JSON, rejette les horodatages au-delà de cinq minutes, vérifie la cohérence de l'événement et de l'environnement dans le payload, puis recoupe l'événement avec le GET GeniusPay avant toute transition. Les credentials API et le secret webhook sont distincts pour sandbox et live ; `GENIUSPAY_MODE` sélectionne les credentials du pay-in. Les mises à jour conditionnelles rendent les transitions répétées idempotentes, mais l'ID de livraison optionnel n'a pas de registre durable dédié. Les versements vendeurs restent en traitement ops tant que l’API de payout n’est pas spécifiée.

Les commandes portent explicitement la devise XOF ; le pay-in GeniusPay refuse les autres devises jusqu’à une intégration fournisseur validée. La création de commandes est réservée aux routes serveur qui vérifient l’acheteur et recalculent les prix depuis le catalogue. Les migrations 058–062 sont additives et doivent être examinées/appliquées explicitement ; aucune migration distante n’est exécutée par le code.

Les nouveaux documents KYC sont déposés dans le bucket privé `kyc-documents` et les liens de revue sont signés temporairement. Les anciens documents qui ont été stockés dans le bucket public `avatars` ne sont pas déplacés par la migration 060 : leur migration sécurisée et la révocation des anciennes URLs restent un préalable opérationnel avant de déclarer l’exposition historique résolue.

La page producteur `/wallet` sert au suivi des commandes et à la demande de versement des ventes livrées, payées et libérées. Les demandes sont réservées atomiquement, visibles dans `/admin/finances/payouts`, et les changements de statut sont audités ; un statut « versé » exige une référence réelle saisie par un administrateur finance. Une demande en échec libère le montant réservé. Les versements manuels sont comptabilisés dans `withdrawal_requests` et ne changent pas `orders.payout_status`. Aucun transfert automatique ni portefeuille de valeur stockée n’est offert : l’équipe effectue le paiement manuellement tant qu’une API de payout validée n’existe pas.
