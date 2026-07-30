# Sécurité GWA (synthèse)

## Déjà en place

- Triggers `protect_*` (profiles / orders) — colonnes privilégiées
- OTP : random crypto + hash ; rate-limit Upstash
- Checkout : `POST /api/orders` (prix serveur, commission selon `subscription_tier`)
- Admin client : `server-only`
- Middleware : gates `/admin`, `/dashboard`, `/panier`…
- Headers : HSTS, CSP, XFO…
- Webhook FeexPay : HMAC obligatoire
- Advisor DB : migration `scripts/schema/048_advisor_hardening.sql`

## À activer manuellement (Dashboard Auth)

**Leaked Password Protection** — Advisor WARN tant que désactivé.  
Supabase → **Authentication → Providers / Attack Protection** → activer *Leaked password protection* (HIBP).  
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Advisor (31/07/2026)

Corrigé en SQL (`scripts/schema/054_advisor_hardening_jul31.sql`) :
- `platform_secrets` : policy deny anon/authenticated
- Auth RLS InitPlan sur coops / abo / withdrawals (`(select auth.uid())`)
- REVOKE EXECUTE `is_coop_*` pour `PUBLIC` / `anon`
- Index FK `subscription_requests.activated_by`

**Accepté (pas un bug)** : `authenticated` peut exécuter `is_coop_manager` / `is_coop_admin_member` — requis par les policies RLS ; les fonctions ne renvoient qu’un booléen lié à `auth.uid()`.

**Ignorer en bêta** : avalanche « Unused Index » — ne pas DROP massif (risque régression perfs plus tard).

## Intégrations

- GitHub → Supabase : OK pour sync migrations si `supabase/` configuré ; aujourd’hui les SQL vivent dans `scripts/schema/` (appliquer via MCP / SQL Editor).
- Vercel Marketplace : sync `NEXT_PUBLIC_*` — secrets serveur (`FEEXPAY_*`, `AT_*`, `GEMINI_*`) restent à vérifier dans Vercel Project Settings.
