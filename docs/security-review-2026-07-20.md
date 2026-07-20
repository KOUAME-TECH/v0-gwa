# Security review — branche icon cleanup + post-merge P0

Scope : nettoyage assets + icône PWA + état agents (diff vs `main`).

## Findings

### Critical
Aucun nouveau finding critique dans ce diff.

### Medium (déjà connus, hors ce diff)
1. **profiles PII** — `authenticated` peut encore lire email/phone (027). Mitigation : appliquer `037_profiles_pii_restrict.sql` post-bêta.
2. **Middleware `/admin`** — session only ; layout + API service role = garde réelle. OK bêta.

### Low / Info
1. Service worker cache shell — ne cache pas `/api/*` (correct).
2. Icônes PWA publiques — attendu.
3. HIBP — enforcement côté Supabase Auth (toggle manuel), messages FR en app.

## Positive (P0 déjà sur main)
- Factoring `roleCanRequestFactoring`
- Admin users GET service role
- Rate limit admin 20/min
- Migration 035 Storage/RPC/audit

## Verdict
**Ship** ce cleanup + nouvelle icône. Pas de régression sécu introduite.
