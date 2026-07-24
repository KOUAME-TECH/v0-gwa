# Backend HTTP — `app/api`

Chaque dossier = un **domaine** aligné sur `lib/<domaine>/`.

| Dossier | Responsabilité |
|---------|----------------|
| `auth/` | OTP, session, lien email, KYC request |
| `orders/` | Création, pay, confirm, litige, statut |
| `products/` | Catalogue / CRUD vendeur |
| `yelly/` | Assistant (chat, history, escalate) |
| `scg/` | Score de confiance |
| `admin/` | Back-office (service role) |
| `onesignal/` · `push/` | Push |
| `webhooks/` | Feexpay etc. |
| `cron/` | Jobs (Digest) |

**Conventions**
1. Auth + `checkRateLimit` en tête de handler.
2. Prix / frais calculés serveur (`lib/pricing`, `products.price`).
3. Pas de logique UI ici — renvoyer JSON.
