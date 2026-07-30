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

Corrigé en SQL :
- `054_advisor_hardening_jul31.sql` — `platform_secrets` deny, RLS InitPlan, index FK
- `054b_coop_helpers_private_schema.sql` — helpers coop en schéma `private` (plus d’RPC public SECURITY DEFINER)

**À faire dans le Dashboard (manuel)** : activer Leaked Password Protection (HIBP).

**Ignorer en bêta** : avalanche « Unused Index » — ne pas DROP massif.

## Intégrations

- GitHub → Supabase : OK pour sync migrations si `supabase/` configuré ; aujourd’hui les SQL vivent dans `scripts/schema/` (appliquer via MCP / SQL Editor).
- Vercel Marketplace : sync `NEXT_PUBLIC_*` — secrets serveur (`FEEXPAY_*`, `AT_*`, `GEMINI_*`) restent à vérifier dans Vercel Project Settings.
