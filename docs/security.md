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

## À activer manuellement

**Leaked Password Protection** (Supabase Auth → Have I Been Pwned)  
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Ne pas accumuler de rapports d’audit redondants dans `docs/` — Advisor + reviews PR suffisent entre deux audits formels.
