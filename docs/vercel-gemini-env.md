# Variables Vercel — Gemini (Yelly)

Coller dans **Vercel → Project → Settings → Environment Variables**.

Cible recommandée : **Production** + **Preview** + **Development**.

| Name | Value | Notes |
|------|-------|--------|
| `GEMINI_API_KEY` | *(clé Google AI Studio — ne jamais committer)* | Obligatoire pour Yelly LLM |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Stable ; éviter `gemini-flash-latest` (thinking tokens) |
| `YELLY_LLM_PROVIDER` | `gemini` | Force Gemini en priorité |

Après enregistrement : **Deployments → … → Redeploy**.

Vérifier : `GET /api/health` → `checks.gemini_api_key: true`, puis un message Yelly avec `source: "llm"`.

Fallback runtime : secret `gemini_api_key` dans `platform_secrets` (service_role only) si l’env Vercel est absente.

**Sécurité :** ne jamais coller la clé dans le chat, un commit, ou un fichier du dépôt. Si une clé a fuité, la régénérer dans Google AI Studio et mettre à jour Vercel + `platform_secrets`.
