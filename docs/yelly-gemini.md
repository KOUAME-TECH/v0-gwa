# Yelly — Gemini (ops)

Yelly appelle Google Gemini (`gemini-flash-latest`).

## Variable Vercel (Production + Preview)

| Nom | Valeur |
|-----|--------|
| `GEMINI_API_KEY` | clé API Google AI Studio (projet GWA) |
| `YELLY_MODEL` | optionnel — défaut `gemini-flash-latest` |

Fallback accepté : `GOOGLE_GENERATIVE_AI_API_KEY`.

Après ajout : Redeploy. Vérifier `/api/health` → `secrets.GEMINI_API_KEY: true`.

**Sécurité :** ne jamais committer la clé dans git. Si elle a été collée dans un chat / mail, la **régénérer** dans Google AI Studio puis mettre à jour Vercel.
