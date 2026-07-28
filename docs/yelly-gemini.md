# Yelly — Gemini (ops)

Yelly appelle Google Gemini (`gemini-flash-latest`).

## Résolution de la clé (ordre)

1. `process.env.GEMINI_API_KEY` (Vercel — recommandé)
2. `GOOGLE_GENERATIVE_AI_API_KEY` / `YELLY_API_KEY`
3. Table privée `platform_secrets` (service_role only) — clé `GEMINI_API_KEY`

## Variable Vercel (Production + Preview)

| Nom | Valeur |
|-----|--------|
| `GEMINI_API_KEY` | clé API Google AI Studio (projet GWA) |
| `YELLY_MODEL` | optionnel — défaut `gemini-flash-latest` |

Après ajout : Redeploy. Vérifier `/api/health` → `secrets.GEMINI_API_KEY: true`.

**Sécurité :** ne jamais committer la clé dans git. Si exposée dans un chat, **régénérer** dans Google AI Studio, mettre à jour Vercel **et** `platform_secrets`.
