# État des lieux pré-prod GWA

Branche : `cursor/harden-weaknesses-f056`  
Prod app : https://v0-gwa-mu.vercel.app  
DB : GWA-DATABASE (`frorfexbcyfbydkiwxqv`)

## Produit — réactions

| Élément | Statut |
|---------|--------|
| Favoris (Bookmark) | OK — table `favorites` |
| Like produit (Heart) | OK — migration `064` appliquée sur GWA-DATABASE |
| Dislike produit | OK — `product_dislikes` + API `/dislike` (appliqué DB) |
| Like publications | OK — `post_likes` |
| Compteurs client JWT | Gelés (trigger protect + sync SECURITY DEFINER) |

Surfaces : Accueil feed, Marché, fiche `/produit/[id]`. Shop + chat inchangés.

## Sécurité — prêt / partiel / gap

### Prêt
- Auth session Supabase + gate admin
- CSRF same-origin (exemptions webhook/cron/callback)
- OTP hashé + pepper obligatoire en prod
- FeexPay pay + webhook HMAC + re-verify + montant
- Escrow cron `CRON_SECRET`
- Withdrawals / factoring insert service_role only
- Money columns frozen client JWT (059–063)
- Rate limit ajouté : comments/like, location/save, places, onesignal/register
- Validation téléphone retrait renforcée

### Partiel (ops avant go-live)
- Upstash `KV_*` obligatoire multi-instance (sinon RL/OTP mémoire)
- SMS AT live : `AT_*` / sender + health `sms_delivery_ready`
- FeexPay live : `FEEXPAY_WEBHOOK_SECRET` + `payin_ready`

### Gaps restants (hors code de ce PR)
- Activer leaked-password protection (dashboard Auth Supabase)
- `REVOKE EXECUTE` sur `protect_*` exposés RPC (advisor)
- RL manquant encore : weather GET, places/[id], link-email, posts DELETE
- `comments_count` encore writable client (à geler plus tard)

## Checklist go-live (Yao / Makan)

1. Appliquer `scripts/schema/064_product_like_dislike.sql` sur GWA-DATABASE
2. Secrets Vercel : `OTP_PEPPER`, `FEEXPAY_WEBHOOK_SECRET`, `CRON_SECRET`, Upstash, AT live, `NEXT_PUBLIC_APP_URL`
3. Smoke : OTP → pay → webhook held → confirm/release → withdraw one-open
4. Smoke : like + dislike produit (exclusifs) + favoris + chat messages
5. `/api/health` : `feexpay.payin_ready` + `sms_delivery_ready` = true
6. Merge PR #12 puis deploy prod
