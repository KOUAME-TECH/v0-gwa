# GO / NO-GO — GWA beta launch (target: 1 Sept 2026)

Scope: F1–F6 only (see `docs/scope-beta.md`). This is the launch gate. A **NO-GO** on any
critical row blocks launch. Owner column: **F**ounder / **C**ode / **I**ntern.

## Critical path (must all be GO)

### 1. SMS OTP login (F3) — see `docs/ops-auth.md`
- [ ] Africa's Talking **live** creds set on Vercel, **no 401** — Owner: F ⛔ (AT 401 blocker)
- [ ] `AT_SENDER_ID` approved for Côte d'Ivoire — Owner: F
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `OTP_PEPPER`, `KV_REST_API_*` set in prod — Owner: F
- [ ] Supabase Email provider on + redirect URLs include prod domain + `/auth/callback` — Owner: F
- [ ] Real test: production login by SMS on a real CI number succeeds — Owner: F/I

### 2. Orders + escrow (F2)
- [ ] `FEEXPAY_API_KEY` + `FEEXPAY_SHOP_ID` + `FEEXPAY_WEBHOOK_SECRET` set — Owner: F ⛔ (Feexpay account)
- [ ] **Feexpay checkout redirect wired** — today `/api/orders/[id]/pay` returns
      `redirect_required` with `payment_url: null` ("finaliser l'intégration SDK marchand").
      The real payment URL / SDK call MUST be implemented — Owner: C ⛔
- [ ] Webhook HMAC verified end-to-end with a real Feexpay test payment — Owner: C/F
- [ ] Escrow releases only on delivery confirmation; no double-release (idempotent) — Owner: C
- [ ] `ALLOW_PAYMENT_SIMULATION` unset in prod (simulation already blocked on `VERCEL_ENV=production`) — Owner: F

### 3. Affacturage file — admin (F6-linked)
- [x] Admin can open a producer's factoring file: SCG (`bancable` + score snapshot) + amount + KYC —
      **code done** `/admin/factoring` + `/api/factoring` + `/api/admin/factoring/[id]` — Owner: C
- [x] Admin records a decision (approve/reject/disburse) with audit trail
      (decider, timestamp, **SCG snapshot**, order id) — **code done** — Owner: C
- [ ] Semi-manual is acceptable; **no auto-disbursement** in beta — Owner: F (policy sign-off)

### 4. SCG (F6)
- [x] Score computes on auth (`verify-otp` / `auth/callback`) and shows on profile/dashboard — Owner: C
- [ ] 5C dimensions traceable to real data; `bancable` threshold signed off — Owner: F
- [x] SCG snapshot persisted for factoring records (not just live reference) —
      **code done** `factoring_requests.scg_score_snapshot/scg_badge_snapshot` — Owner: C
- ℹ️ SCG **v2 5C full rewrite is post-beta**. The current v1 engine (`lib/scg/engine.ts`) +
      snapshot at request time is sufficient for lean beta closure.

### 5. Admin / KYC (F5)
- [ ] Admin gated by `admin_roles` (active) + middleware; first admin seeded (`scripts/ops`) — Owner: F
- [x] KYC verification queue works (approve/reject) — **code done** via
      `/api/admin/verifications/[id]` (service role, no client-side privileged writes) — Owner: C
- [x] Product & user moderation works — Owner: C

### 6. Notifications (F4)
- [ ] OneSignal keys set; push registers and delivers on order events — Owner: F/C (prod not yet tested)
- [x] In-app notifications write + read correctly (list + mark-read + link + empty-state CTA) — Owner: C

## Platform readiness (should be GO)
- [ ] Security headers live (HSTS/CSP/XFO/nosniff) — already in `next.config.mjs` ✅
- [ ] RLS on all user-data tables; privileged columns trigger-protected — Owner: C (verify)
- [ ] No secret in `NEXT_PUBLIC_*`; `.env.local` not committed — Owner: all
- [x] Out-of-scope routes soft-locked; leftovers deleted (`communaute`, `dashboard/student|business`)
      + `/communaute` redirect added — Owner: I/C
- [x] `lib/routes/inventory.ts` reflects reality (affacturage/facture/export now complete) — Owner: I/C
- [x] `OTP_PEPPER` required in production (fail closed if missing when `VERCEL_ENV=production`) — Owner: C
- [ ] Run `@gwa-security` review on auth + payments + admin before launch — Owner: F

## Human-action blockers (cannot be fixed by code alone)
| Blocker | Impact | Needed from |
|---------|--------|-------------|
| **AT 401** | SMS OTP login DOWN | Founder: valid live Africa's Talking key + username |
| **Feexpay account** | No real escrow payments | Founder: production merchant account (key, shop id, webhook secret) |
| **Feexpay checkout wiring** | Keys set but no payment URL | Code: implement merchant SDK/redirect in `pay` route |
| **SIDONOBIEL** | Partner/entity dependency | Founder: confirm contract / data / signer scope |
| **Interns (x2)** | Delivery capacity | Founder: onboard + assign runbooks (this doc, ops-auth, scope-beta) |

## Contact / Aide — destination des e-mails
- Le formulaire `/contact` poste vers `POST /api/contact` → `lib/email/agentmail.ts` (AgentMail).
- **Destination réelle** : `CONTACT_INBOX_TO` (fallback `AGENTMAIL_CONTACT_TO`, puis défaut
  `gwa-contact@agentmail.to`). Aujourd'hui, sans override, les messages arrivent dans l'inbox
  AgentMail **`gwa-contact@agentmail.to`** surveillée par l'équipe GWA.
- Envoi authentifié par `AGENTMAIL_API_KEY` + `AGENTMAIL_INBOX_ID`. Si la clé manque, l'API
  renvoie 502 « AGENTMAIL_API_KEY manquante » — vérifier l'env Vercel.
- ⚠️ Dans `.env.local`, les valeurs `AGENTMAIL_INBOX_ID` / `CONTACT_INBOX_TO` contiennent un
  `\n` final entre guillemets ; il est neutralisé par `.trim()` côté code, mais préférer une
  valeur propre en prod pour éviter tout risque de destinataire invalide.
- Canal prioritaire affiché aux utilisateurs : **WhatsApp +225 07 88 32 60 19**
  (`https://wa.me/2250788326019`). Bureau unique : **Abidjan**. Les mêmes coordonnées et la
  destination e-mail sont rappelées dans `/conditions` et `/confidentialite`.

## Sécurité Supabase (migration `035`)
- [ ] **Leaked password protection** activée dans Supabase Dashboard → Authentication →
      Password security (plan Pro+). Message FR côté app : `lib/auth/auth-errors.ts`.
- [x] Storage : plus de SELECT public sur tout un bucket ; URLs CDN `/object/public/…` OK ;
      listing réservé dossier `{uid}/…` + `service_role` — `035_security_hardening_storage_rpc_audit.sql`
- [x] RPC `is_super_admin` / `is_active_admin` : EXECUTE révoqué pour `anon`/`authenticated`
- [x] `audit_logs` : INSERT permissif supprimé ; écriture backend via `service_role` uniquement
- [ ] Re-smoke après `035` : images produits, upload avatar, admin login, formulaire contact

**Workflow migrations** : toute policy SQL → fichier `scripts/schema/0xx_*.sql` versionné Git ;
appliquer via SQL Editor ou `supabase db push` ; jamais uniquement en UI sans commit.

## Launch decision
GO only when **all Section 1–2 critical rows are GO** and Sections 3–6 are GO or have a
signed-off manual workaround. Otherwise **NO-GO** and re-date.
