# GWA — Continuité d’activité (ISO 22301)

**Statut** : document vivant — Excellence Protocol  
**Prod** : https://mygwa.org · Supabase `GWA-DATABASE` · Vercel

## Objectifs

| Indicateur | Cible | Preuve actuelle |
| --- | --- | --- |
| RTO app (Vercel) | ≤ 1 h | Redeploy Git / rollback alias |
| RPO base | ≤ 24 h | Backups managés Supabase (plan projet) |
| Chat offline | Messages file locale | `lib/chat/local-store.ts` outbox + brouillons |

## Sauvegardes

- **Supabase** : backups automatiques plateforme — [ACTION HUMAINE REQUISE] vérifier rétention / PITR dans le dashboard.
- **Storage chat-media** : objets sous `{uid}/{conversationId}/` — restauration = restore bucket + DB messages.
- **Secrets** : Vercel env — ne pas committer.

## Reprise

1. Santé : Vercel deployment + Supabase advisors.
2. Auth : OTP / Google OAuth.
3. Chat : RLS messages/conversations + Storage policies `chat_media_*`.
4. Paiements : hors scope excellence chat (GeniusPay/FeexPay non modifiés).

## Test de restauration

- [ ] [ACTION HUMAINE REQUISE] Exercice restore backup Supabase (staging) documenté avec horodatage.
- [ ] Vérifier flush outbox chat après `online` event (Playwright + Network Offline).
