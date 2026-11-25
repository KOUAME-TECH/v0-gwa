# ADR-014 — SCG en TypeScript (FastAPI à M+6), application PWA (Expo à M+9)

- **Statut :** Accepté (Yao, 25 novembre 2026, 09:06 Africa/Abidjan)
- **Date :** 25 novembre 2026 (Africa/Abidjan)
- **Périmètre :** stack du Score de Confiance GWA et de l’application cliente (amendement dit « §8.2 »)
- **Amendement :** [CDC v2.0](../CDC-v2.0-amendements.md) §3

## Contexte

Yao a demandé d’amender le cahier des charges (§8.2) : SCG en TypeScript (FastAPI prévu M+6), application PWA (Expo prévu M+9). Le CDC v1.0 n’a pas de §8.2 numéroté ; la décision s’applique à l’architecture (§E) et à la trajectoire SCG / client.

Le code actuel est déjà aligné sur l’état « aujourd’hui » de cette décision :

- SCG v1 : TypeScript dans `lib/scg/` (l’en-tête de `engine.ts` parle d’un port de l’algorithme FastAPI, référence interne `GWA-TECH-SCG-014`), exposé par `/api/scg/*` et `/api/admin/scg`. Aucun service FastAPI n’est présent dans le dépôt.
- Application : PWA Next.js (manifeste, service worker, meta d’installation). Aucune dépendance Expo / React Native, aucun dépôt mobile jumeau dans ce repo.
- L’inventaire des routes annonce encore un « SCG v2 FastAPI post-bêta », formulation antérieure à cet arbitrage de calendrier.

Le monolithe Next.js (App Router, route handlers, `lib/*`) reste la contrainte d’architecture de la bêta.

## Décision

1. **Aujourd’hui :** le SCG est développé, testé et déployé en TypeScript, dans le monolithe. L’application utilisateur est une PWA.
2. **M+6 :** un service FastAPI pourra être introduit pour le SCG (typiquement une v2 / modèle 5C, calcul isolé, éventuellement exposition partenaire). Ce n’est pas un chantier immédiat. Tant qu’il n’est pas livré, TypeScript reste la source de vérité du score.
3. **M+9 :** une application Expo pourra être ajoutée (stores, notifications natives, hors ligne enrichi). La PWA n’est pas retirée par cette prévision ; le calendrier et le périmètre Expo feront l’objet d’une décision de lancement dédiée.
4. Les dates M+6 / M+9 s’entendent dans le cadrage du CDC v1.0 (horizon zéro = août 2026), soit typiquement février 2027 et mai 2027, et restent des prévisions.

## Alternatives

- Réécrire le SCG en FastAPI maintenant : coût et risque hors priorité, alors que le moteur v1 TypeScript est livré.
- Commencer Expo avant de stabiliser la PWA et le paiement : double surface de recette, alors que la directive place Expo à M+9.
- Documenter FastAPI et Expo comme l’état actuel : faux, et déjà corrigé dans le pack investisseurs en brouillon.

## Conséquences

- Recrutement, roadmap technique et discours externe doivent présenter une PWA TypeScript / Next.js, pas une app Expo ni un backend FastAPI déjà en service.
- L’inventaire (`lib/routes/inventory.ts`) et les docs agents pourront être alignés ultérieurement (« FastAPI prévu M+6 », plus « post-bêta » comme fait accompli).
- Un futur service FastAPI ou une app Expo naîtront par PR dédiées, avec GO QA, sans réécriture opportuniste du moteur v1.
