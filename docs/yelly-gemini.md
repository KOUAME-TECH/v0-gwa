# Yelly — Gemini (ops)

Yelly appelle Google Gemini (`gemini-3.1-flash-lite` par défaut).

## Variables Vercel

Coller dans **Settings → Environment Variables** (Production + Preview + Development) :

| Name | Value | Notes |
|------|-------|--------|
| `GEMINI_API_KEY` | *(clé Google AI Studio — ne jamais committer)* | Obligatoire |
| `GEMINI_MODEL` ou `YELLY_MODEL` | `gemini-3.1-flash-lite` | Éviter `gemini-flash-latest` (thinking) |
| `YELLY_LLM_PROVIDER` | `gemini` | Force Gemini en priorité |

Après enregistrement → **Redeploy**.  
Vérifier : `/api/health` → `secrets.GEMINI_API_KEY: true`, puis message Yelly `source: "llm"`.

## Résolution de la clé (ordre)

1. `GEMINI_API_KEY` (Vercel — recommandé)
2. `GOOGLE_GENERATIVE_AI_API_KEY` / `YELLY_API_KEY`
3. Table `platform_secrets` (service_role) — clé `GEMINI_API_KEY`

**Sécurité :** ne jamais committer la clé. Si exposée → régénérer + maj Vercel **et** `platform_secrets`.
