# Exercice de restauration (dry-run) — GWA Chat

**Date** : 2026-11-02  
**Type** : tabletop / dry-run agent (pas de restore prod destructif)  
**Environnement** : Supabase `GWA-DATABASE` (`frorfexbcyfbydkiwxqv`) · Vercel · mygwa.org

## Objectifs

| Indicateur | Cible | Résultat dry-run |
| --- | --- | --- |
| RTO app | ≤ 1 h | Redeploy / rollback Vercel documenté — **OK procédural** |
| RPO DB | ≤ 24 h | Backups managés Supabase — **[ACTION HUMAINE] confirmer PITR** |
| Chat media | Objets + paths | Bucket `chat-media` **privé** (068) — restore = DB paths + sign |

## Étapes simulées

1. **Santé** : advisors security → WARN unique `auth_leaked_password_protection` (humain).
2. **Auth** : OTP / Google OAuth non modifiés dans ce protocole.
3. **Chat RLS** : policies `messages` / `conversations` / `chat_media_*` présentes.
4. **Outbox** : `lib/chat/local-store.ts` + flush sur `online` / `gwa:online-sync`.
5. **Storage** : pas de `getPublicUrl` fallback — `createSignedUrl` only.

## Preuves

- Migration 068 appliquée (`public=false` sur `chat-media`) — SQL verify OK.
- Tests vitest outbox + sign-only + QR ISO.
- Screenshots Playwright login (evidence).

## Décision

Dry-run **PASS** côté agent. Restore backup physique = **ACTION HUMAINE REQUISE** (staging).
