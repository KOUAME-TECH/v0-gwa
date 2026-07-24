# Domaine métier — `lib`

Code **backend** partagé (importable depuis `app/api` et Server Components).  
Pas de JSX.

| Dossier | Domaine |
|---------|---------|
| `auth/` | OTP, téléphone, erreurs auth |
| `orders/` | Escrow flow, labels humains |
| `pricing/` | Frais de service selon abo |
| `products/` · `catalog/` | Produits |
| `scg/` | Score de confiance |
| `yelly/` | Prompt / client aide |
| `supabase/` | Clients DB (`admin` = server-only) |
| `security/` | Rate-limit, origin |
| `notifications/` | OneSignal |
| `cart/` · `chat/` · `comments/` | … |

Nouvelle règle métier → nouveau module ici, puis route dans `app/api/`.
