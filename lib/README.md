# Domaine métier — `lib`

Code **backend** partagé (importable depuis `app/api` et Server Components).  
Pas de JSX.

**Nouveau dans l’équipe ?** → [`docs/onboarding-equipe.md`](../docs/onboarding-equipe.md)

| Dossier | Domaine |
|---------|---------|
| `pricing/` | Commissions + **entitlements** abo (`entitlements.ts`) |
| `feexpay/` | Pay-in / payout Mobile Money |
| `orders/` | Escrow flow, labels humains |
| `cooperatives/` | Rôles + qualification progressive |
| `auth/` | OTP, téléphone, erreurs auth |
| `products/` · `catalog/` | Produits |
| `scg/` | Score de confiance |
| `yelly/` | Client Gemini / aide |
| `offline/` | Outbox publish, caches |
| `supabase/` | Clients DB (`admin` = server-only) |
| `security/` | Rate-limit, origin |
| `notifications/` | OneSignal |
| `factoring/` | Éligibilité affacturage |
| `cart/` · `chat/` · `comments/` | … |

Nouvelle règle métier → nouveau module ici, puis route dans `app/api/`.
