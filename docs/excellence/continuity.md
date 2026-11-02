# GWA — Continuité d’activité (ISO 22301)

**Statut** : document vivant — Excellence Protocol  
**Prod** : https://mygwa.org · Supabase `GWA-DATABASE` · Vercel

## Objectifs

| Indicateur | Cible | Preuve actuelle |
| --- | --- | --- |
| RTO app (Vercel) | ≤ 1 h | Redeploy Git / rollback alias |
| RPO base | ≤ 24 h | Backups managés Supabase (plan projet) |
| RTO rate-limit Redis | ≤ 5 min | Upstash `gwa-prod` PING PONG · `KV_REST_*` |
| Chat offline | Messages file locale | `lib/chat/local-store.ts` outbox + brouillons |

## Sauvegardes

- **Supabase** : backups automatiques plateforme — [ACTION HUMAINE REQUISE] vérifier rétention / PITR dans le dashboard (`GWA-DATABASE` / `frorfexbcyfbydkiwxqv`).
  - Vérifié agent 2026-11-02 : projet `ACTIVE_HEALTHY`, Postgres 17 — **PITR on/off non exposé via MCP SQL** (dashboard Billing/Database → Point in Time Recovery uniquement). Ne pas inventer un statut PITR.
  - Restore physique staging : toujours **ACTION HUMAINE**.
- **Upstash Redis `gwa-prod`** (rate-limit) : plan **free**, state `active`, PING `PONG` (MCP 2026-11-02). `redis_list_backups` → **aucun backup listé** (attendu sur free) — RPO Redis = volatile ; app fail-closed/fail-open selon route.
- **Storage chat-media** : objets sous `{uid}/{conversationId}/` — restauration = restore bucket + DB messages.
- **Secrets** : Vercel env — ne pas committer.

## Reprise

1. Santé : Vercel deployment + Supabase advisors.
2. Auth : OTP / Google OAuth.
3. Chat : RLS messages/conversations + Storage policies `chat_media_*`.
4. Paiements : hors scope excellence chat (GeniusPay/FeexPay non modifiés).

## Test de restauration

- [x] Dry-run tabletop documenté : `docs/excellence/restore-drill.md` (2026-11-02).
- [x] Flush outbox sur `online` + `gwa:online-sync` + prune échecs (`pruneFailedOutbox`).
- [ ] [ACTION HUMAINE REQUISE] Exercice restore backup Supabase physique (staging) avec horodatage.

## Checklist humaine

Voir `docs/excellence/HUMAN-CHECKLIST.md` (HIBP, PITR, Redis backups, E2E auth, deploy tip).
