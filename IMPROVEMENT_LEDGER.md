# IMPROVEMENT_LEDGER — GWA

Registre des améliorations et des dettes, avec preuve et décision attendue. Mis à jour le 25 novembre 2026 (Africa/Abidjan) par le Lot D (phases 2 à 6 de la directive t127u).

Légende : ✅ fait dans le dépôt · ⏳ attend le go de Yao · 🔧 à faire · ⚠️ urgent

## Sécurité

| # | Sujet | État | Preuve / action |
|---|---|---|---|
| S1 | Rotation de la clé Gemini requise (détails transmis hors dépôt, dépôt public) | ⚠️⏳ | Nouvelle clé AI Studio, révocation de l’ancienne, mise à jour de `platform_secrets` par Yao |
| S2 | Yelly en repli (`source: fallback`) en prod et en preview le 25/11 | ⚠️⏳ | Cause à confirmer dans les logs Vercel (MCP en 403). Repli déterministe ajouté (prix repère, accord). |
| S3 | OTP : TTL 10 min → 5 min, usage unique (verrou), 5 vérifications/h et 5 envois/h par numéro | ✅ | `tests/otp-policy.test.ts`, ADR-017 |
| S4 | npm : 1 critique + 6 hautes | ✅ | 0 critique / 0 haute (`npm audit`), un seul lockfile |
| S5 | Service Worker : `/notifications`, `/favoris`, `/facture`, `/publier`, `/abonnement`, `/scg`, `/auth` n’étaient pas exclus du cache | ✅ | v23, `tests/sw-private-cache.test.ts` |
| S6 | CSP : `connect-src` autorise `api.openai.com`, `api.groq.com` (appels serveur uniquement) et `*.vercel.app` (trop large) ; `script-src 'unsafe-inline'` | 🔧 | `next.config.mjs` est modifié par le Lot C (#54) : à resserrer après sa fusion. |
| S7 | **Régression possible du Lot C** : la PR #54, basée sur un ancien `main`, retire de `next.config.mjs` les en-têtes `Cache-Control: no-store` des pages privées et du `gwa-sw-core.js` | ⚠️ | À corriger au rebase de #54. |
| S8 | `.env.example` contenait un en-tête JWT générique (faux positif gitleaks) | ✅ | Remplacé par des libellés explicites |
| S9 | Typecheck : `finance_admin` manquant dans `lib/admin/ai-entitlements.ts` (déjà présent sur main) | 🔧 | Corrigé par #54 (Lot C) |

## E-mail et DNS

| # | Sujet | État | Preuve / action |
|---|---|---|---|
| E1 | DKIM mygwa.org introuvable (sélecteurs courants) | ⏳ | Générer la clé DKIM dans Zoho Mail Admin, ajouter le TXT dans Vercel DNS (changement DNS : go Yao) |
| E2 | DMARC `p=quarantine` sans DKIM : dépend uniquement de SPF | ⏳ | Après E1, suivre les rapports `rua` puis envisager `p=reject` |
| E3 | Supabase Auth : expéditeur et SMTP personnalisés non vérifiables par MCP | ⏳ | Configurer le SMTP Zoho et coller `emails/password-reset.supabase.html` |
| E4 | Aucun e-mail de confirmation de commande (push et in-app seulement) | 🔧⏳ | Gabarit prêt (`renderOrderConfirmationEmail`) ; branchement SMTP après go |
| E5 | Test de délivrabilité (mail-tester) | ⏳ | Nécessite un envoi réel : go Yao |

## Données et exploitation

| # | Sujet | État | Preuve / action |
|---|---|---|---|
| D1 | Supabase sur le plan **Free** : pas de sauvegarde quotidienne restaurable ni de PITR | ⚠️⏳ | Passer en Pro (sauvegardes quotidiennes sur 7 jours) ou mettre en place un `pg_dump` chiffré hors GitHub (le dépôt est public : jamais d’artefact Actions). Test de restauration sur une branche Supabase (payante) après go. |
| D2 | Migrations 080 (réactions, masquage) et 081 (index FK) | ⏳ | Fichiers et rollbacks dans `scripts/schema/` |
| D3 | `schema_migrations` ne trace pas 077 et 079 ; environ 20 migrations en prod sans fichier dans le dépôt | 🔧 | Audit de la phase 1 |
| D4 | `/api/health` annonce `sw_cache: gwa-v21-offline` (le SW réel est en v23) | 🔧 | Fichier du Lot C (#46) |

## Performance et accessibilité (Lighthouse mobile, prod, 25/11)

| Page | Perf | A11y | BP | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Accueil | 68 | 96 | 96 | 100 | 7,3 s | 0 |
| Boutique | 87 | 100 | 96 | 100 | 2,9 s | 0,145 |
| Profil (déconnecté) | 88 | 100 | 96 | 100 | 3,0 s | 0 |

| # | Sujet | État |
|---|---|---|
| P1 | Accueil : LCP 7,3 s. La première image du flux attend le chargement client des données (2,1 s de délai de ressource). Rendre la première carte côté serveur. | 🔧 |
| P2 | Boutique : CLS 0,145 causé par l’image du héros sans boîte réservée | ✅ (`aspect-[4/5]`) |
| P3 | `/favicon.ico` en 404 et 401 `admin-status` pour les visiteurs dans la console | ✅ (icônes déclarées, appel uniquement si session) |
| P4 | axe WCAG 2.2 : « label in name » (J’aime, Commenter, Digest), contraste (pages légales) | ✅ |
| P5 | Lien « Acheter » de l’accueil : cible tactile partiellement masquée, et `<Button>` imbriqué dans `<Link>` | 🔧 |
| P6 | 16 `<img>` bruts (aperçus blob, URLs signées, admin) ; images catalogue via `next/image` (AVIF/WebP) | 🔧 mineur |
