# Scripts

| Dossier / fichier | Usage |
|-------------------|--------|
| `schema/` | Migrations SQL `001` → `048…` (ordre strict) |
| `ops/` | Bootstrap admin, checks pré-déploiement |
| `demo/` | Seed démo — **jamais** en prod sans intention |
| `auth-smoke.mjs` · `smoke-audit.mjs` · `verify-admin-fix.mjs` | Smoke tests manuels |

Appliquer le schéma via SQL Editor Supabase ou MCP `apply_migration`.
