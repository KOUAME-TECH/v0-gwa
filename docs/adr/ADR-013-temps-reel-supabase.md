# ADR-013 — Temps réel : Supabase Realtime, pas Socket.io

- **Statut :** Accepté (Yao, 25 novembre 2026, 09:06 Africa/Abidjan)
- **Date :** 25 novembre 2026 (Africa/Abidjan)
- **Périmètre :** bus temps réel in-app (messages, conversation, badges)
- **Amendement :** [CDC v2.0](../CDC-v2.0-amendements.md) §2

## Contexte

La directive du 25 novembre 2026 demande de remplacer, dans la documentation, Socket.io par Supabase Realtime. Le CDC v1.0 ne mentionnait pas Socket.io. L’architecture historique (`docs/architecture.md`) décrivait déjà le client Supabase navigateur pour la lecture et le temps réel soumis à la RLS.

Sur `main` @ `a53e021`, le dépôt n’a pas de dépendance Socket.io. Les canaux effectifs utilisent `supabase.channel(...).on("postgres_changes", ...)` dans la boîte de réception, la conversation de chat et le store de badges de navigation. Le push mobile / navigateur reste OneSignal. Le hook `use-realtime-location` désigne la géolocalisation GPS, pas Realtime.

## Décision

1. Supabase Realtime est le seul bus temps réel de l’application.
2. On n’introduit pas Socket.io (ni un serveur WebSocket dédié) pour le chat, l’inbox ou les badges.
3. Les mutations sensibles (envoi, paiement, OTP, admin) restent sur `app/api/*` ; Realtime sert à la notification de changements déjà écrits en base, dans le périmètre autorisé par la RLS.
4. OneSignal reste le canal push hors application ouverte.

## Alternatives

- Ajouter Socket.io « en plus » pour un chat plus riche : double infrastructure, second modèle d’auth, écart avec la RLS déjà en place.
- Tout tirer au polling : plus simple, mais moins adapté au chat déjà livré.
- Laisser la doc parler de Socket.io par inertie : faux par rapport au code.

## Conséquences

- Toute nouvelle feature temps réel (présence, saisie en cours, etc.) doit d’abord évaluer un canal Realtime + RLS, pas un nouveau serveur.
- Le nommage `use-realtime-location` pourra être clarifié plus tard pour éviter la confusion avec Realtime.
- Pas de changement de runtime dans cette décision.
