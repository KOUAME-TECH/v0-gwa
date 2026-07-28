# Yelly — Gemini (ops)

Yelly appelle Google Gemini (`gemini-3.1-flash-lite` par défaut — réponses stables sans thinking).

## Résolution de la clé (ordre)

1. `process.env.GEMINI_API_KEY` (Vercel — recommandé)
2. `GOOGLE_GENERATIVE_AI_API_KEY` / `YELLY_API_KEY`
3. Table privée `platform_secrets` (service_role only) — clé `GEMINI_API_KEY`

## Variables

| Nom | Valeur |
|-----|--------|
| `GEMINI_API_KEY` | clé Google AI Studio |
| `YELLY_MODEL` | optionnel — défaut `gemini-3.1-flash-lite` |

Éviter `gemini-flash-latest` / `gemini-3.5-flash` pour le chat : le mode thinking consomme le budget tokens et tronque les réponses.

Après ajout : Redeploy. Vérifier `/api/health` → `secrets.GEMINI_API_KEY: true`.

**Sécurité :** ne jamais committer la clé. Si exposée, **régénérer** puis mettre à jour Vercel **et** `platform_secrets`.
