# ADR-016 — Yelly : appel direct à Gemini, contexte caviardé, limites

- **Statut :** Proposé (Lot D, 25 novembre 2026, Africa/Abidjan), à valider par Yao
- **Périmètre :** `app/api/yelly/chat`, `lib/yelly/*`, [docs/ai-governance.md](../ai-governance.md)

## Contexte

Yelly répond aux acheteurs et vendeurs (prix, offres, commandes). Vercel ne porte aucune variable `GEMINI*` ou `GOOGLE*` (seulement `YELLY_MODEL`). Le code n’utilise ni Vercel AI Gateway ni OIDC : `lib/yelly/client.ts` appelle directement `generativelanguage.googleapis.com` avec l’en-tête `X-goog-api-key`. La clé est résolue par `resolvePlatformSecret("GEMINI_API_KEY")` : variable d’environnement d’abord, sinon table `platform_secrets` (lecture service role). En prod, la clé vient de `platform_secrets`.

Le 25 novembre 2026, les deux appels de test (preview et prod) sont revenus en `source: "fallback"` : le modèle ne répond pas.

## Décision

1. On garde l’appel direct Gemini côté serveur, sans clé côté client.
2. Avant tout envoi, le contexte (produit, 8 derniers messages, rôle) passe par `redactPiiForAi`.
3. On applique 10 requêtes/min par utilisateur (Upstash), avec un quota par palier et un quota invité de 3 par 24 h.
4. FAQ et cache sont réservés aux questions sans contexte.
5. Si le modèle est indisponible, `deterministicCapabilityReply` calcule une fourchette de prix ±10 % et détecte l’accord, sans inventer de chiffre.
6. Chaque réponse porte l’avertissement « Yelly est une assistante, pas une décision financière. »

## Alternatives

- **Vercel AI Gateway avec OIDC :** plus de clé statique et une observabilité native. C’est une migration possible, à décider plus tard.
- **Clé dans les variables Vercel :** possible. La table `platform_secrets` permet une rotation sans redéploiement.

## Conséquences

- **Action Yao :** régénérer la clé Gemini dans Google AI Studio, révoquer l’ancienne, puis mettre à jour `platform_secrets.GEMINI_API_KEY`. C’est une écriture en prod, donc elle attend son go.
- Une réponse en `fallback` en prod doit déclencher une alerte : à ajouter au monitoring ([IMPROVEMENT_LEDGER](../../IMPROVEMENT_LEDGER.md)).
