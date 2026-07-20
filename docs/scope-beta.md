# Scope lock — Beta F1–F6

Beta perimeter (1 Sept 2026): **F1 agri catalog, F2 orders/escrow, F3 profiles/KYC,
F4 notifications, F5 admin, F6 SCG**. Everything else is out of scope.
**No artisanat. No e-learning.** Enforce with `@gwa-scope-guardian`.

## Out-of-scope modules — current state (2026-07-18)

Two mechanisms are in play:
- **Soft-lock**: a redirect in `next.config.mjs` (`permanent: false`, 307) so the route is
  inaccessible even if a page file lingers.
- **Removed**: the page file was deleted from the working tree.

| Module | Route(s) | Redirect target | Page file |
|--------|----------|-----------------|-----------|
| Formations | `/formations`, `/formations/*` | `/` | removed |
| Learning | `/learning`, `/learning/*` | `/` | removed |
| B2B | `/b2b` | `/marketplace` | removed |
| Business | `/business` | `/agriculture` | removed |
| Network (social) | `/network`, `/network/profile/:id` | `/messages`, `/profil/:id` | removed |
| Artisanat | `/artisans`, `/artisans/*` | `/agriculture` | removed |
| Dashboard student | `/dashboard/student` | `/dashboard` | ✅ removed |
| Dashboard business | `/dashboard/business` | `/dashboard/farmer` | ✅ removed |
| Communauté (social) | `/communaute`, `/communaute/*` | `/messages` | ✅ removed + redirect |

### Cleanup backlog (safe, post-audit)
- ✅ Deleted leftover pages: `app/dashboard/student`, `app/dashboard/business`, `app/communaute`.
- ✅ `/communaute → /messages` redirect added in `next.config.mjs` so community is not reachable in beta.

Legacy **canonical aliases** (kept, `permanent: true`): `/profile→/profil`,
`/agriculture/produit/:id→/produit/:id`, `/marketplace/product/:id→/produit/:id`,
`/dashboard/artisan→/dashboard/farmer`.

Source of truth for route status: `lib/routes/inventory.ts` (UI: `/dev/routes`).

## Section "Moi" (`/profil` + bottom-nav)

| Entrée | Route | Statut |
|--------|-------|--------|
| Messages | `/messages` | OK |
| Notifications | `/notifications` + API | OK |
| Paramètres | `/profil/edit` | OK |
| Installer l'app | `/download` | OK PWA |
| Aide | `/contact` | OK |
| Se déconnecter | `/api/auth/logout` | OK |
| GWA v1.0.0 | footer | OK |

## Gaps F1–F6 restants (beta must-haves)

- **F2 escrow**: Feexpay live account + webhook HMAC end-to-end (❌ blocked on merchant account — human).
- **F1 SMS OTP**: Africa's Talking 401 (❌ blocked — human, valid live creds needed).
- **F6 SCG v2**: 5C model live + threshold sign-off is **post-beta**. ✅ Lean closure: v1 engine
  (`lib/scg/engine.ts`) + snapshot at factoring request time is sufficient for beta.

### Code-closed (⚠️ → ✅) — 19 Jul 2026
- ✅ **Affacturage** semi-manuel : `factoring_requests` (SQL 029) + `/affacturage` (demande + statut) +
  `/admin/factoring` (file, décision approve/reject/disburse, notes, audit `decided_by/decided_at` + snapshot SCG).
- ✅ **Facture numérique** : `invoices` (SQL 030) générée à la confirmation acheteur +
  `/api/invoices/[id]` (JSON) + `/facture/[id]` (page imprimable HTML/PDF).
- ✅ **Export CSV** : `/api/admin/export?entity=users|orders|products|factoring` (admin only).
- ✅ **KYC admin** : `/api/admin/verifications/[id]` (service role) — plus d'écriture privilégiée client.
- ✅ **Notifications** in-app : liste + mark-read + lien + empty-state CTA (push OneSignal non testé prod).
- ✅ **Sécurité** : `OTP_PEPPER` obligatoire en production (fail closed).

See `docs/ops-go-live.md` for the GO/NO-GO checklist and `docs/ops-auth.md` for SMS OTP login.
