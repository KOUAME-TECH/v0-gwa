# Sécurité GWA (synthèse)

## Déjà en place

- Triggers `protect_*` (profiles / orders) — colonnes privilégiées
- OTP : random crypto + hash ; rate-limit Upstash
- Checkout : `POST /api/orders` (prix serveur, frais selon `subscription_tier`)
- Admin client : `server-only`
- Middleware : gates `/admin`, `/dashboard`, `/panier`…
- Headers : HSTS, CSP, XFO…
- Advisor DB (juil. 2026) : migration `scripts/schema/048_advisor_hardening.sql`

## À activer manuellement

**Leaked Password Protection** (Supabase Auth → Have I Been Pwned)  
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Revue ponctuelle

Dernier audit full : `docs/audit-complet-2026-07-24.md`.  
Ne pas accumuler des rapports redondants — Advisor + PR reviews entre deux audits.
