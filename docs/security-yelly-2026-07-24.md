# Sécurité + Yelly — juil. 2026

## Correctifs sécurité (cette vague)

| Priorité | Faille | Correctif |
|----------|--------|-----------|
| P0 | `GET /api/admin/migrations/039\|040?apply=1` pouvait appliquer du DDL | GET = **statut seul** + `requireSuperAdmin` ; apply = **POST** + CSRF |
| P1 | Filtres PostgREST `.or()` (admin users, products) | `sanitizeForQuery` renforcé (quotes, opérateurs, longueur) |
| P1 | CSRF / Origin manquant sur mutations cookie | `assertSameOrigin` en **middleware** + routes critiques |
| P1 | Bio / textes utilisateur HTML | `sanitizeHtml` / `sanitizePlainText` (profil, produits, contact, commentaires) |
| P2 | CSP `unsafe-eval` | **retiré** ; `connect-src` OpenAI/Groq pour Yelly |
| P2 | Rate-limit Yelly | `YELLY_CHAT` 20/min + blocage 5 min |

## Yelly v0

- UI FAB globale (`YellyFab`) + panneau chat (dots CSS existants)
- `POST /api/yelly/chat` — auth, CSRF, zod (`yellyChatSchema`), rate-limit
- Fallback mots-clés si `YELLY_API_KEY` absent (démo / résilience)
- LLM OpenAI-compatible : `YELLY_API_KEY`, `YELLY_MODEL`, `YELLY_BASE_URL`
- SQL `047_yelly_conversations.sql` — tables + RLS owner-only

### Variables Vercel

```
YELLY_API_KEY=sk-...
YELLY_MODEL=gpt-4o-mini
# optionnel Groq :
# YELLY_BASE_URL=https://api.groq.com/openai/v1
# YELLY_MODEL=llama-3.3-70b-versatile
```

## Tests

`npx vitest run tests/security-yelly.test.ts tests/yelly.test.ts`
