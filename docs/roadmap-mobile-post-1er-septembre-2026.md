# Roadmap mobile native — après le 1er septembre 2026

**Décision :** jusqu’au **1er septembre 2026**, le canal principal reste la **PWA web** (Vercel + shell mobile).  
La **version mobile native** (store) démarre **après** cette date.

## Jusqu’au 1er sept — focus PWA

| Priorité | Travail |
|----------|---------|
| Argent | FeexPay E2E + escrow payout fiable |
| Auth | `AT_SENDER_ID` (SMS Africa’s Talking) |
| Push | OneSignal web (≠ SMS) |
| UX terrain | Offline text, shell unique, confirm acheteur, abo |
| Sécu | RBAC admin API, trigger profils privilégiés |

**Ne pas** lancer Capacitor / React Native / builds App Store–Play avant cette date, sauf spike technique isolé hors chemin critique.

## Après le 1er sept — piste native

1. Choisir enveloppe (Capacitor autour de la PWA vs app dédiée).
2. Réutiliser OneSignal (SDK mobile) ; SMS OTP reste Africa’s Talking.
3. Deep links `/commandes`, `/messages`, pay return URL FeexPay.
4. Parité offline (photos) + push permission iOS/Android.
5. Soft-launch CI (TestFlight / internal testing) avant stores publics.

## Lien avec l’audit

Voir [`audit-complet-propositions-2026-08-03.md`](./audit-complet-propositions-2026-08-03.md) — les P0/P1 web restent le prérequis du mobile.
