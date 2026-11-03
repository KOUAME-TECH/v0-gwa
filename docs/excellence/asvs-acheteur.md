# ASVS L2 — Parcours Acheteur

**Date** : 2026-11-02 · Branche `gwa/excellence-parcours-1e99`

| Contrôle | Statut | Preuve |
| --- | --- | --- |
| V2 Auth gates | OK | `/dashboard/buyer`, `/favoris`, `/dashboard/commandes`, `/messages` → login+redirect |
| V4 CSRF same-origin | OK | orders POST, confirm, litige, pay, release, shipment, verify-payment, status |
| V5 Input validation | OK | Zod `orderCreateSchema` + sanitize adresse |
| V8 Stored XSS | OK | sanitizePlainText shipping ; pas de HTML brut |
| V13 API rate limit | OK | `checkRateLimit` sur mutations commande |
| V14 RLS | OK | orders buyer_id / cart_items user_id (héritage schema) |

**WARN humain** : HaveIBeenPwned Auth désactivé (advisor Supabase).

GeniusPay/FeexPay : **non modifiés** (wrappers CSRF uniquement).
