# Architecture GWA — Frontend / Backend

Monolithe **Next.js App Router** déployé sur Vercel. Une seule app, deux couches clairement séparées.

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (navigateur / PWA)                            │
│  app/**/page.tsx  ·  components/  ·  hooks/  ·  public/ │
└───────────────────────────┬─────────────────────────────┘
                            │ fetch /api/*  +  Supabase client
┌───────────────────────────▼─────────────────────────────┐
│  BACKEND (serveur Next)                                 │
│  app/api/**/route.ts  ·  lib/**  ·  middleware.ts       │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Supabase DB         Upstash Redis        OneSignal / SMS
   (scripts/schema)    (rate-limit/OTP)     (push / Africa’s Talking)
```

## Frontend (UI)

| Chemin | Rôle |
|--------|------|
| `app/**/page.tsx` | Pages (écrans utilisateur) |
| `app/**/layout.tsx` | Shells (admin, auth, etc.) |
| `components/` | UI réutilisable par domaine |
| `components/ui/` | Primitives shadcn |
| `components/brand/` | Marque GWA (`GwaMark`) |
| `hooks/` | État client (panier, commandes, a11y…) |
| `public/` | Assets statiques (logo, PWA, SW) |

**Règle :** pas de secret, pas de logique métier lourde (prix, escrow, OTP) dans les pages. Appeler `app/api/*` ou `lib/*` via le serveur.

## Backend (API + domaine)

| Chemin | Rôle |
|--------|------|
| `app/api/<domaine>/` | Route Handlers HTTP (frontière publique) |
| `lib/<domaine>/` | Logique métier pure (auth, orders, scg, pricing…) |
| `lib/supabase/` | Clients `browser` / `server` / `admin` (`server-only`) |
| `lib/security/` | Rate-limit, validation, origin |
| `middleware.ts` | Auth gates, headers sécurité |
| `scripts/schema/` | Migrations SQL versionnées |

**Règle :** toute mutation sensible (commande, paiement, OTP, admin) passe par `app/api/*` + rate-limit. Le client Supabase browser reste pour lecture / realtime autorisés RLS.

### Domaines API (alignés sur `lib/`)

```
app/api/auth/          ↔  lib/auth/
app/api/orders/        ↔  lib/orders/ + lib/pricing/
app/api/products/      ↔  lib/products/ + lib/catalog/
app/api/yelly/         ↔  lib/yelly/
app/api/scg/           ↔  lib/scg/
app/api/onesignal/     ↔  lib/notifications/
app/api/admin/         ↔  lib/supabase/admin + checks rôle
```

## Ajouter une feature (checklist)

1. Domaine métier → `lib/<domaine>/`
2. Endpoint → `app/api/<domaine>/route.ts` (auth + rate-limit)
3. UI → `components/<domaine>/` + page `app/<route>/page.tsx`
4. Migration si schéma → `scripts/schema/0XX_*.sql`
5. Statut route → ligne dans `lib/routes/inventory.ts`

## Ce qu’on ne fait pas (bêta)

- Pas de second serveur Node séparé (tout passe par Next API Routes).
- Pas de microservices tant que le monolithe reste clair par domaine.
- Pas de seed démo en prod (`scripts/demo/` = optionnel).
- **Pas de positionnement concurrent aux banques/IMF** — partenaires uniquement (`docs/positionnement-partenaires-bancaires.md`).

## Fichiers de vérité

| Sujet | Fichier |
|-------|---------|
| Statut des routes | `lib/routes/inventory.ts` |
| Scope produit | `docs/scope-beta.md` |
| Banques / IMF | `docs/positionnement-partenaires-bancaires.md` |
| Logo / marque | `docs/brand.md` |
| Ops Auth / OTP | `docs/ops-auth.md` |
| Advisor DB | `scripts/schema/048_advisor_hardening.sql` |
| Sécurité | `docs/security.md` |
