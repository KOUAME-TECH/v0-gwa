# ADR-015 — Convention des routes HTTP : `/api` plutôt que `/api/v1`

- **Statut :** Accepté (publication documentaire, 25 novembre 2026, Africa/Abidjan)
- **Date :** 25 novembre 2026 (Africa/Abidjan)
- **Périmètre :** préfixe des Route Handlers du monolithe Next.js, distinct des API prestataires
- **Amendement :** [CDC v2.0](../CDC-v2.0-amendements.md) §4

## Contexte

Le CDC v1.0 §E décrit `PWA → /api/* (mutations sensibles)`. Le Coordinateur a demandé un constat et une recommandation sur `/api` versus `/api/v1`.

Constat sur `main` @ `a53e021` :

- 87 fichiers `app/api/**/route.ts` ;
- aucun arbre `app/api/v1/` ;
- les chaînes `/api/v1` du dépôt pointent vers des API **externes** (GeniusPay, OneSignal), pas vers GWA.

Versionner maintenant toutes les routes internes en `/api/v1` imposerait une migration large (clients, middleware, CSP, tests, deep links) sans contrat public à protéger. À l’inverse, une API partenaire future (CDC §G.2, option lecture vers M+12) aura besoin d’un versioning explicite dès le premier endpoint.

## Décision

1. Les routes de l’application (BFF du monolithe) restent sous **`/api/<domaine>/...`**, sans numéro de version.
2. Le préfixe **`/api/v1/` est réservé** à une éventuelle API publique ou partenaire. Il n’est pas créé « pour plus tard » tant qu’aucun consommateur externe stable n’est décidé.
3. On ne duplique pas les routes existantes sous les deux préfixes.
4. Si une API publique est lancée, elle naît en `/api/v1` avec authentification, contrat documenté et politique de dépréciation. Une rupture se fera par `/api/v2`, pas en réécrivant silencieusement `/api/v1`.

## Alternatives

- Tout migrer vers `/api/v1` maintenant : coût élevé, bénéfice nul tant que les seuls clients sont la PWA et le back-office du même dépôt.
- Introduire `/api/v1` en miroir progressif : double maintenance et risque d’écart de comportement.
- Utiliser `/api/v1` dès qu’un script interne appelle l’app : confusion avec l’API prestataire et fausse promesse de stabilité publique.

## Conséquences

- Les nouvelles routes applicatives (feature flags admin, wallet, etc.) continuent de naître sous `/api/...`.
- Une future API Enterprise / banque ne réutilise pas tel quel le BFF interne : elle a son propre contrat, sa propre auth et son préfixe versionné.
- Cette décision ne crée, ne déplace et ne supprime aucune route.
