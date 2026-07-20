# Scripts SQL

| Dossier | Usage |
|---------|--------|
| `schema/` | Migrations dans l’ordre `001` → `025`. Appliquer une fois (ou via historique Supabase). |
| `ops/` | Admin bootstrap, tests manuels, checks pré-déploiement. |
| `demo/` | Données démo investisseurs — **pas** sur prod sans intention. |
| `set-vercel-env.ps1` | Helper PowerShell pour pousser des env Vercel (à compléter vs `.env.example`). |

`025_migration_consolidee_f1_f5.sql` documente l’état consolidé F1–F5 déjà appliqué ; les numéros `021`–`024` n’existent pas en fichiers séparés.
