# GWA Platform

Business Unit de **KOUAME Corporation** — marketplace agroalimentaire PWA (Côte d’Ivoire).

**Tech Lead GWA :** Makan Diabaté (pilotage quotidien — prise en main)  
**DG / supervision :** Yao Kouamé (vérification ponctuelle)

**Prod :** https://mygwa.org  
**Repo :** https://github.com/KOUAME-TECH/v0-gwa (public : aucun secret dans le code ni dans l’historique)

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
| **CDC v2.0 (amendements) / ADR** | [docs/CDC-v2.0-amendements.md](./docs/CDC-v2.0-amendements.md) · [docs/adr/](./docs/adr/) |
| **Améliorations / dettes** | [IMPROVEMENT_LEDGER.md](./IMPROVEMENT_LEDGER.md) |
| **IA (Yelly) / Juridique** | [docs/ai-governance.md](./docs/ai-governance.md) · [docs/legal/](./docs/legal/) |

### Accès équipe (rappel)

- Head → **Can edit** uniquement sur **sa** page Département (Membres + Travail).
- Stagiaire / nouveau → **Can view** sur son département + [Je démarre ici](https://app.notion.com/p/3b5a6d3a76b4814699f7eae8ead6829b).
- Ne pas partager Operations secrètes, CRM, ni les autres départements.

Ce dépôt = le code, ce README, et le dossier `docs/` (amendements du cahier des charges et ADR). La documentation produit élargie reste dans Notion.

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
npm install --legacy-peer-deps   # un seul lockfile : package-lock.json (Vercel installe avec npm)
# Demander .env.local au lead (ne jamais committer de secrets)
npm run dev
npm run typecheck && npm run lint && npx vitest run
```

## Sécurité (résumé)

- **OTP SMS :** code à 6 chiffres haché (SHA-256 + `OTP_PEPPER`), valable **5 min**, usage unique (supprimé à la validation + verrou anti-concurrence), 5 essais par code, **5 vérifications et 5 envois par heure et par numéro** (`OTP_POLICY` dans `lib/auth/otp-store.ts`).
- **Yelly (Gemini) :** clé serveur lue dans `platform_secrets` (ou env), données personnelles masquées avant envoi, 10 requêtes/min par utilisateur, repli déterministe si le modèle est indisponible. Voir [ADR-016](./docs/adr/ADR-016-yelly-ia.md).
- **E-mails :** comptes via Supabase Auth ; domaine mygwa.org chez Zoho (SPF + DMARC présents, DKIM à publier). Gabarits HTML dans `emails/` et `lib/email/templates.ts`. Voir [ADR-017](./docs/adr/ADR-017-otp-emails.md).
- **PWA :** le Service Worker ne met jamais en cache les pages liées à un compte (`PRIVATE_PREFIXES` dans `public/gwa-sw-core.js`).
- **En-têtes :** HSTS, CSP, X-Frame-Options, nosniff, Referrer/Permissions-Policy (`next.config.mjs`).

## Déploiement & SQL

- Push `main` → Vercel prod. Chaque branche a une preview `v0-gwa-git-<branche>-kouametech.vercel.app`.
- Les fichiers `scripts/schema/NNN_*.sql` ne sont **jamais** appliqués automatiquement : application manuelle, après go de Yao, avec le `.rollback.sql` correspondant.
- La prod Supabase est déclarée au niveau 064 d’après le schéma fourni. La nouvelle fonctionnalité de versement nécessite la migration additive `scripts/schema/065_manual_seller_payouts.sql` ; ne rejouez pas 058–064 sans vérifier l’état réel de la base.
- GitHub Supabase Deploy = **OFF**.

## Ops urgents

1. GeniusPay : `GENIUSPAY_MODE` (`sandbox` ou `live`) et, pour chaque mode utilisé, `GENIUSPAY_API_KEY_<MODE>`, `GENIUSPAY_API_SECRET_<MODE>` et `GENIUSPAY_WEBHOOK_SECRET_<MODE>` (serveur uniquement)
2. OTP téléphone : fournisseur SMS live, expéditeur approuvé, Redis persistant et `OTP_PEPPER`
3. Contenu de lancement provenant uniquement de sources réelles et autorisées ; aucune donnée de démonstration en production

Le pay-in GeniusPay utilise les headers serveur `X-API-Key` et `X-API-Secret`, puis redirige vers le checkout hébergé. La confirmation s'appuie sur le statut documenté `completed`, vérifié côté serveur avec la référence, le montant, la devise et les métadonnées de commande. Le webhook `/api/webhooks/geniuspay` vérifie HMAC-SHA256 sur `timestamp + "." + corps brut`, rejette les horodatages au-delà de cinq minutes, refuse une enveloppe ou un paiement `sandbox` lorsque `GENIUSPAY_MODE` n’est pas `sandbox`, puis recoupe la référence avec `GET /api/v1/merchant/payments/{reference}` avant toute transition. Seul un paiement `completed` dont le montant (franc XOF arrondi), la devise et la référence concordent — et `metadata.order_id` lorsqu’il est présent — passe la commande en `paid`. Les credentials API et le secret webhook sont distincts pour sandbox et live ; `GENIUSPAY_MODE` sélectionne les credentials du pay-in. Les mises à jour conditionnelles rendent les transitions répétées idempotentes, mais l'ID de livraison optionnel n'a pas de registre durable dédié. Si l’initiation renvoie un résultat incertain sans référence fournisseur, la commande reste en traitement et est journalisée : l’équipe doit vérifier le tableau de bord GeniusPay avant toute nouvelle tentative, sans marquer la commande payée sur la seule base de la redirection. Les versements vendeurs restent en traitement ops tant que l’API de payout n’est pas spécifiée.

Les commandes portent explicitement la devise XOF ; le pay-in GeniusPay refuse les autres devises jusqu’à une intégration fournisseur validée. La création de commandes est réservée aux routes serveur qui vérifient l’acheteur et recalculent les prix depuis le catalogue. Le snapshot de production 064 fourni ne liste pas `orders.provider_reference` ni `orders.currency`. La migration additive 065 les crée si nécessaire, vérifie le format de devise et protège ces colonnes contre les mises à jour client. Elle doit être examinée puis appliquée explicitement ; aucune migration distante n’est exécutée par le code.

Les nouveaux documents KYC sont déposés dans le bucket privé `kyc-documents` et les liens de revue sont signés temporairement. Les anciens documents qui ont été stockés dans le bucket public `avatars` ne sont pas déplacés par la migration 060 : leur migration sécurisée et la révocation des anciennes URLs restent un préalable opérationnel avant de déclarer l’exposition historique résolue.

La page producteur `/wallet` sert au suivi des commandes et à la demande de versement des ventes livrées, payées et libérées. Les demandes sont réservées atomiquement, visibles dans `/admin/finances/payouts`, et les changements de statut sont audités ; un statut « versé » exige une référence réelle saisie par un administrateur finance. Une demande en échec libère le montant réservé. Les versements manuels sont comptabilisés dans `withdrawal_requests` et ne changent pas `orders.payout_status`. Aucun transfert automatique ni portefeuille de valeur stockée n’est offert : l’équipe effectue le paiement manuellement tant qu’une API de payout validée n’existe pas.
