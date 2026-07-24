# Sécurité GWA (synthèse)

## Déjà en place

- Triggers `protect_*` (profiles / orders) — colonnes privilégiées
- OTP : random crypto + hash ; rate-limit Upstash
- Checkout : `POST /api/orders` (prix serveur, frais selon `subscription_tier`)
- Admin client : `server-only`
- Middleware : gates `/admin`, `/dashboard`, `/panier`…
- Headers : HSTS, CSP, XFO…
- Advisor DB (juil. 2026) : voir `docs/supabase-advisor-hardening-2026-07-24.md`

## À activer manuellement

**Leaked Password Protection** (Supabase Auth → Have I Been Pwned)  
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Revue ponctuelle

Ne pas accumuler des rapports datés dans le repo. Utiliser Advisor + PR reviews.
