# ⚙️ Admin & Ops

**Domaine stable** — outils internes, workflows, modération, go-live.

---

## État actuel

- Backoffice `/admin` avec rôles : `super_admin` · `admin` · `support` · `moderator`.
- **RBAC API** : `requireAdminSection` / `requireAdminAction` (2026-08-03).
- **Double identité** : même Auth = compte métier + admin_roles ; login ouvre l’espace métier.
- Sections : users, products, orders, support, disputes, verifications, finances, factoring, subscriptions, Yelly Ops, settings…
- Go-live checklist : `docs/ops-go-live.md` — FeexPay + AT_SENDER_ID encore ⛔.

## Règles établies

1. Staff **sans** `user_type` métier → land `/admin` ; dual → land dashboard rôle (T/P).
2. Mutations sensibles profil (tier, verify, suspend) = **service_role** uniquement (migration 056).
3. Activation abo = section `subscriptions` uniquement.
4. Secrets serveur (FeexPay, AT, Gemini, OTP) = Vercel env — pas dans le repo.
5. Migrations SQL = `scripts/schema/` ; Deploy GitHub Supabase **OFF** sauf process migré.

## Workflows ops courants

| Workflow | Où |
|----------|-----|
| Activer abo après WhatsApp | `/admin/subscriptions` |
| Support / contact | `/admin/support` |
| KYC / vérif | `/admin/verifications` |
| Litiges | `/admin/disputes` |
| Affacturage décisions | `/admin/factoring` |
| Santé stack | `/api/health` (widget admin encore P2) |

## Questions ouvertes

- Qui est on-call activation abo / support WhatsApp ?
- Bootstrap premier admin : durcir race (P0-C) avant d’inviter plus d’admins ?
- Mode ops masquable pour dual-identity ?

## Liens repo

- `docs/ops-go-live.md` · `docs/ops-auth.md` · `docs/ops-support-backoffice.md`
- `lib/auth/admin-permissions.ts` · `lib/auth/dual-identity.ts`
- `docs/audit-complet-propositions-2026-08-03-v2.md`
