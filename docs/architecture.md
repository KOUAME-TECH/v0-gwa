# Architecture GWA

## Principes

1. **Une route canonique par intention** — les alias legacy sont dans `next.config.mjs` (`redirects`), pas des pages mock.
2. **`lib/` par domaine** — auth, scg, supabase, security, email, notifications, routes. Pas de monolithe utilitaire.
3. **API Routes = frontière serveur** — mutations métier passent par `app/api/*` (rate-limit + auth), pas uniquement par client Supabase.
4. **Inventaire vivant** — `lib/routes/inventory.ts` est la source de vérité du statut (complete / partial / redirect / missing). UI : `/dev/routes`.
5. **SQL versionné** — `scripts/schema/` = historique schéma ; `ops/` = bootstrap admin / checks ; `demo/` = seed optionnel.

## Flux principaux

```
Auth OTP  →  /api/auth/send-otp + verify-otp  →  session Supabase
Produits  →  /api/products[+id]              →  marketplace /publier
Commandes →  /api/orders[+id]/pay|confirm    →  escrow (Feexpay à brancher)
SCG       →  lib/scg/engine + /api/scg/calculate
Push      →  OneSignal + /api/onesignal/register + /api/messages/notify
```

## Scalabilité (conventions)

| Besoin | Où agir |
|--------|---------|
| Nouvelle feature métier | `lib/<domaine>/` + `app/api/<domaine>/` + page `app/<route>/` |
| Nouveau statut route | Une ligne dans `lib/routes/inventory.ts` |
| Migration DB | Nouveau fichier `scripts/schema/0XX_*.sql` (ne pas réécrire l’historique) |
| Rate-limit / cache | `lib/security/upstash.ts` |
| Env | `.env.example` + Vercel ; jamais committer `.env.local` |

## Sécurité (normes SaaS)

| Contrôle | Implémentation |
|----------|----------------|
| Colonnes privilégiées | Triggers `protect_*` (profiles / orders) — seuls service_role / admin actif |
| RPC dangereux | `promote_to_admin` révoqué pour `anon` / `authenticated` |
| OTP | `crypto.randomInt` + SHA-256 + pepper ; jamais plaintext Redis |
| Paiement | Simulation interdite en prod Vercel sans `ALLOW_PAYMENT_SIMULATION` |
| Webhook Feexpay | HMAC obligatoire + MAJ via service role |
| Prix commandes | Toujours depuis `products.price` (ignore body client) |
| Checkout | `POST /api/orders` uniquement |
| Headers | HSTS, CSP, XFO, nosniff, Permissions-Policy |
| Admin client | `import "server-only"` sur `lib/supabase/admin.ts` |
| Auth routes | Middleware protège `/admin`, `/dashboard`, `/panier`, etc. |

Source de vérité statut routes : `lib/routes/inventory.ts`.
