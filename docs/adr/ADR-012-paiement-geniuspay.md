# ADR-012 — Prestataire de paiement : FeexPay remplacé par GeniusPay

- **Statut :** Accepté (Yao, 25 novembre 2026, 09:06 Africa/Abidjan)
- **Date :** 25 novembre 2026 (Africa/Abidjan)
- **Périmètre :** documentation et contrainte CdC ; le remplacement est déjà en production de code depuis le 21 octobre 2026
- **Amendement :** [CDC v2.0](../CDC-v2.0-amendements.md) §1

## Contexte

Le cahier des charges v1.0 (28 juillet 2026) nomme **FeexPay** comme prestataire primaire d’encaissement et de versement, avec CinetPay en plan B. Le code a basculé le pay-in vers **GeniusPay** le 21 octobre 2026 (`b8ec6d4`). Le README et les routes `lib/payment/geniuspay.ts`, `POST /api/orders/[id]/pay`, `POST /api/webhooks/geniuspay` et `POST /api/orders/[id]/verify-payment` décrivent ce flux. Des mentions FeexPay subsistent dans l’inventaire des routes, les agents Cursor et quelques commentaires.

Yao a demandé, le 25 novembre 2026, de mettre à jour la documentation : FeexPay → GeniusPay, en version 2.0 du cahier des charges.

L’escrow reste applicatif : GWA décide du moment de libération ; les fonds transitent par le compte marchand de l’agrégateur. Il n’y a pas de séquestre natif prestataire à revendiquer dans le discours public.

## Décision

1. GeniusPay est le prestataire d’encaissement documenté et implémenté.
2. Les versements vendeurs restent une file manuelle tant que le payout prestataire n’est pas spécifié et branché. `geniuspay.payout_ready` vaut `false` par construction dans `/api/health` ; ce n’est pas un champ lu en base.
3. Le plan B CinetPay et l’abstraction multi-prestataires du CDC v1.0 ne sont plus un livrable lié à FeexPay. Toute introduction d’un second prestataire exigera une nouvelle décision et un nouvel ADR.
4. Les correctifs de mentions FeexPay restantes dans le code (inventaire, agents) sont des dettes de documentation / inventaire, hors de cette décision produit.

## Alternatives

- Réécrire tout le CDC v1.0 dans Notion dès maintenant : souhaitable plus tard, trop large pour cette publication.
- Revenir à FeexPay dans la doc « le temps que le live soit prouvé » : contredit le code depuis le 21 octobre 2026 et la directive du 25 novembre.
- Documenter un dual FeexPay / GeniusPay : aucun chemin FeexPay d’encaissement n’existe plus dans le monolithe.

## Conséquences

- Les documents produit, ops et investisseurs doivent citer GeniusPay, pas FeexPay, pour l’encaissement.
- Les ADR antérieurs relatifs à GeniusPay (micro-paiement, webhook, grand livre) restent valides ; celui-ci ne les remplace pas.
- Pas de changement de comportement runtime dans cette décision. Aucun paiement réel n’est autorisé par ce document.
