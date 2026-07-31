# Yelly — Gemini (ops)

Yelly appelle Google Gemini (`gemini-3.1-flash-lite` par défaut).

## Quotas par palier d’abonnement

Chaque abo a ses avantages **et** un plafond de requêtes Yelly (messages user / jour) :

| Profil | Limite / jour | Où c’est codé |
|--------|---------------|---------------|
| Invité | 3 / 24h | cookie `yelly_guest_n` |
| Free (+ acheteur retail) | 10 | `entitlements.yellyRequestsPerDay` |
| Starter | 40 | idem |
| Pro | 120 | idem |
| Enterprise | illimité | `null` + rate-limit IP `YELLY_CHAT` |

Réponse API utile UX : `yellyLimit`, `yellyRemaining` (ou `guestRemaining`).  
UI : afficher le reste dans le panneau Yelly + CTA upgrade si 429 `YELLY_DAILY_LIMIT`.

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
