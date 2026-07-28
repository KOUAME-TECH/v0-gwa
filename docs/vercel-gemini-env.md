# Vercel — variables Gemini / Yelly (à coller)

Copie ces variables dans **Vercel → Project `v0-gwa` → Settings → Environment Variables**.  
Coche **Production** + **Preview** (+ Development si tu veux). Puis **Redeploy**.

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | `AIzaSyAoFvQtF_AdTLBG96zKv7VZy0yGDyqQOSI` |
| `YELLY_MODEL` | `gemini-3.1-flash-lite` |

Optionnel (alias accepté par le code) :

| Name | Value |
|------|--------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | *(même clé que ci-dessus, seulement si tu préfères ce nom)* |

## Référence projet Google (info, pas à coller dans Vercel)

| Champ | Valeur |
|-------|--------|
| Nom clé | `gwa` |
| Nom du projet | `projects/771227788476` |
| Numéro du projet | `771227788476` |

## Vérification

Après redeploy : `https://v0-gwa-mu.vercel.app/api/health` → `secrets.GEMINI_API_KEY: true`.  
Test Yelly dans l’app : une réponse avec `source: llm`.

## Sécurité

Cette clé a été partagée en clair (chat). **Régénère-la** dans Google AI Studio dès que possible, puis mets à jour Vercel **et** la ligne `GEMINI_API_KEY` dans `platform_secrets` (Supabase).
