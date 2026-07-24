# Audit complet GWA — 24 juillet 2026

**Prod :** https://v0-gwa-mu.vercel.app  
**Commit de référence :** `main` (post-cleanup)  
**Sources :** code, Vitest, Supabase MCP (Advisor + SQL live), Vercel MCP, OneSignal MCP, Playwright, `gh`, `/api/health`

---

## Verdict

Plateforme **bêta avancée, saine en runtime** (health OK, 0 erreur runtime Vercel 7j, feed live).  
**3 failles critiques** confirmées (dont 1 middleware admin bloquant) — correctifs P0 poussés dans ce lot.  
Reste ops manuelle : **HIBP** (Advisor WARN), FeexPay live (`payment_url`), Twilio optionnel.

| Indicateur | Valeur |
|------------|--------|
| Pages | 61 |
| Routes API | 59 |
| Migrations appliquées (DB) | 019→048 (liste MCP) |
| Tests Vitest | **140 / 140** |
| Prod health | `healthy`, `db: connected` |
| Runtime errors Vercel 7j | **0** |
| Advisors sécu | 1 WARN (HIBP) |
| Advisors perf | 94 INFO (indexes FK inutilisés — attendu) |
| Données live | 11 profiles, 3 admins, 3 products, 2 orders, 24 messages |

---

## Stack observée (live)

| Couche | État |
|--------|------|
| Vercel prod `v0-gwa` | READY · Node 24 · région CDG |
| Supabase `GWA-DATABASE` (`frorfexbcyfbydkiwxqv`) | ACTIVE_HEALTHY · PG 17 |
| OneSignal app `5f01e343-…` | OK · 1 notif envoyée (web push) |
| Secrets health | OTP_PEPPER, CRON, SMS_AT, OneSignal ✅ · Twilio/Termii ❌ |
| Headers sécu | HSTS, CSP, XFO, nosniff ✅ |

---

## Critique (P0) — preuves + statut

| ID | Finding | Preuve | Statut |
|----|---------|--------|--------|
| C1 | Middleware appelait `rpc("is_admin")` **inexistant** → admins exclus | SQL live `has_is_admin=false` ; `middleware.ts` | **Corrigé** → SELECT `admin_roles` (RLS own-row) |
| C2 | Prix négocié chat mutable → `from-offer` trust JSON | RLS UPDATE messages ; `from-offer` | **Mitigé** : plafond = prix catalogue, buyer-only, stock |
| C3 | Webhook FeexPay sans vérif montant | `webhooks/feexpay` | **Corrigé** : compare amount vs `total_amount` + idempotence |

## Haut (P1)

| ID | Finding | Statut |
|----|---------|--------|
| H1 | Vendeur pouvait annuler commande `paid`/`held` | **Corrigé** |
| H2 | Litige API sans exiger `paid` | **Corrigé** |
| H3–H4 | Admin settings/finances via client anon + RLS | Ouvert — migrer vers `/api/admin/*` |
| H5 | Bootstrap 1er admin race | Ouvert — désactiver dès qu’il y a ≥1 admin (déjà 3) |
| H6–H7 | CSRF / cron bypass headers | Ouvert — resserrer |
| H8 | FeexPay live `payment_url: null` | Ouvert — partenaire |

## Moyen (P2)

- OTP mémoire si Upstash down · pas de stock sur `/api/orders` catalogue  
- Confirm escrow avant ship · refund dispute = DB only  
- `sw.js` offline non enregistré (OneSignal worker seul) · health ment sur `sw_cache`  
- CSP bloquait CSS OneSignal → **corrigé** `style-src`  
- Rate-limit manquant confirm/litige/status · geocode ouvert  
- `typescript.ignoreBuildErrors: true`

## Playwright (prod)

- Home 200 : feed produits (piment, cacao, tomate), nav 5 onglets, logo GWA  
- Console : `Permission blocked` OneSignal (attendu sans geste user) ; CSP style OneSignal (fixé)  
- Auth gates : `/admin` `/panier` `/messages` → 307 login  

---

## Manuel restant

1. Supabase Auth → **Leaked Password Protection** ON  
2. Brancher FeexPay live + webhook amount fields alignés  
3. (Option) Twilio SMS fallback  
4. Admin finances/settings → API service role  

---

## Architecture (rappel)

Voir [`architecture.md`](./architecture.md) · Logo [`brand.md`](./brand.md)  
Frontend : `app/**/page.tsx`, `components/`, `hooks/`  
Backend : `app/api/**`, `lib/**`, `middleware.ts`, `scripts/schema/`
