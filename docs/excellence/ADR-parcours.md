# ADR — Excellence parcours (audit 100)

## Contexte
Cinq parcours (Producteur, Acheteur, Coopérative, Abonnement, Back-office) + chat doivent tenir un score ≥ 95 avec preuves, avant merge.

## Décisions
1. **Marque** : vert `#1F5C2E` + or `#C27D10` extraits de `public/icon.svg` — pas de rebrand.
2. **Rate-limit IA** : 10 req/min, **Redis Upstash obligatoire** (`requireRedis`) — le fallback mémoire est inefficace sur Vercel serverless.
3. **PII profiles** : anon n’a plus SELECT sur `email`/`phone` (grants colonnes) ; marketplace via colonnes publiques.
4. **CSRF** : toutes mutations admin + social via `assertSameOrigin`.
5. **Paiements** : GeniusPay / FeexPay gelés.

## Conséquences
- Sans `KV_REST_*` en prod, Yelly/IA renvoient 429 (fail-closed) après déploiement de ce correctif.
- Preview PR #27 bloqué côté plan Vercel org → action humaine.
