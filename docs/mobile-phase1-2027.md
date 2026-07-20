# Phase 1 2027 — Mobile React Native + WatermelonDB

> **Hors périmètre bêta web (sept. 2026).** Ce document fige la direction pour ne pas diluer le GO.

## Objectifs

- App **Android first** (Expo EAS) ; iOS Phase 2.
- Offline-first catalogue + messages déjà consultés (2G/3G CI).
- Réutiliser les API Next.js / Supabase existantes (pas de nouveau backend).

## Stack

| Couche | Choix |
|--------|-------|
| UI | React Native + Expo |
| Sync | WatermelonDB + sync différée |
| Auth | Supabase Auth (mêmes sessions / deep links) |
| Push | OneSignal |
| Paiement | Feexpay CI (WebView / SDK) |

## Périmètre Phase 1 (indicatif)

1. Auth téléphone/email
2. Catalogue agriculture + détail produit (cache local)
3. Panier + statut commandes (lecture offline)
4. Chat 1:1 (messages déjà syncés offline)
5. Notifications push

## Hors Phase 1

- Affacturage décaissement auto
- Dashboard banque
- SCG v2 calcul on-device
- Wallet interne

## Prérequis avant kickoff mobile

- Bêta web GO (F1–F6)
- Feexpay + AT SMS stables en prod
- Contrats API documentés (`/api/products`, `/api/orders`, `/api/messages`)

## Repo

Nouveau package / app Expo **additif** (monorepo optionnel) — **ne pas** casser le monolithe Next.js Vercel.
