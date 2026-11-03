# ASVS 5.0 L2 — Cartographie parcours Producteur

| Contrôle | Couverture | Preuve |
| --- | --- | --- |
| V2 Auth | Gates `/dashboard/farmer`, `/publier`, `/wallet`, `/profil/verification` | Playwright redirects login |
| V3 Session | Cookies Supabase SSR | `lib/supabase/*` |
| V4 Access | RLS products/orders/withdrawals ; seller_id | SQL `pg_policies` |
| V5 Validation | Zod/checks amount ≥1000, phone, KYC paths owned | `withdraw/route`, `verification-request` |
| V6 Crypto | Storage KYC privé | bucket `kyc-documents` public=false |
| V7 Error | Messages FR sans stack | UI toast / JSON error |
| V8 Data | Pas de GeniusPay secrets dans UI | hors scope mutations API |
| V9 Logging | Breadcrumbs farmer sans PII | `lib/farmer/observability.ts` |
| V10 Malicious | CSRF same-origin withdraw + KYC + product PATCH/DELETE | `assertSameOrigin` |
| V11 Business | Entitlements stats Starter+ | `/api/seller/stats` 403 |
| V13 API | Rate limit PAYMENT + KYC_UPLOAD | Upstash/`rate-limiter` |
| V14 Config | WARN HIBP Auth | Advisor security |

**WARN humain** : activer HaveIBeenPwned (Auth).
