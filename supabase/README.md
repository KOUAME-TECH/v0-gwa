# Dossier Supabase CLI / GitHub Integration

Les migrations GWA vivent dans **`scripts/schema/`** (source de vérité historique).

Ce dossier existe pour l’écran Supabase → Integrations → GitHub
(« Working directory » = `.` attend un dossier `supabase/`).

## Configuration recommandée (Dashboard)

| Champ | Valeur recommandée |
|-------|--------------------|
| GitHub repo | `MYSTERE-arch/v0-gwa` |
| Working directory | `.` |
| Deploy to production | **OFF** (ne pas auto-appliquer au merge) |
| Production branch | `main` |

Pourquoi Deploy OFF : l’historique est dans `scripts/schema/0XX_*.sql`, pas dans
`supabase/migrations/`. Activer le deploy GitHub sans migrer l’historique
risque des doubles applications ou un schéma désynchronisé.

## Appliquer une migration

1. Ajouter `scripts/schema/0XX_….sql`
2. Appliquer via SQL Editor / MCP `apply_migration` / agent
3. Commit + push `main`

## Vercel Marketplace

L’intégration sync surtout les variables **`NEXT_PUBLIC_*`**.  
Les secrets serveur (`FEEXPAY_*`, `AT_*`, `GEMINI_*`, `OTP_PEPPER`…) restent
à vérifier dans **Vercel → Project → Settings → Environment Variables**.
