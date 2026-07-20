# Ops — Auth (SMS OTP login) go-live checklist

GWA auth = **Supabase session** unlocked by **SMS OTP** (Africa's Talking), with phone
linked to an email. This is NOT Clerk/Auth0 — do not migrate. This page lists exactly what
must be green for a producer to log in by SMS in production.

## How the flow actually works

```
Login (phone) → POST /api/auth/send-otp
   ├─ phone must already exist in profiles (exact E.164 match, anti-enumeration)
   ├─ hasSmsProvider() must be true (AT_API_KEY set)
   ├─ Path A: Supabase native phone OTP (auth.signInWithOtp) if Phone provider is on
   └─ Path B (default): custom 6-digit OTP → SMS via Africa's Talking
                        code hashed (SHA-256 + OTP_PEPPER) in Upstash/KV or memory

Enter code → POST /api/auth/verify-otp
   ├─ Path B: verify hash → admin.generateLink(magiclink, linked_email)
   │          → supabase.verifyOtp(email token_hash) → SESSION
   └─ Path A: supabase.verifyOtp(phone, sms) → SESSION
   → resolvePostAuthRedirect → /admin | /auth/onboarding | /dashboard/{farmer,buyer,cooperative}
```

Key consequence: **the default path (B) needs the account to have a `linked_email`**, because
the session is minted via a Supabase email magiclink. New users sign up by email first, then
link their phone (`/api/auth/link-email`). Pure phone-only accounts require Supabase Phone
provider (Path A) to be enabled.

## Phone binding (bind) vs login — anti-takeover rules (HIGH-1)

A phone number is an **identity claim** and is only trusted after an OTP proof. Two flows:

- **login** (unauthenticated `send-otp`): allowed **only** if the number already exists in
  `profiles` with `phone_verified = true`. Unknown / unverified numbers return the same generic
  400 (anti-enumeration) — we never lookup-then-login an unverified number.
- **bind** (authenticated `send-otp`): a logged-in user attaches a phone to **their own**
  account. The pending OTP is associated to the **session `userId`** (not resolved by phone
  lookup). `verify-otp` writes `phone` + `phone_verified` **only if the current session uid
  matches** the OTP's `userId`. Binding is refused if the number is already `phone_verified` on
  a different account.

Hard invariants:
- `profiles.phone` / `profiles.phone_verified` are **never** written by anon/authenticated
  clients. A DB trigger (`028_protect_phone.sql`) freezes both columns to their OLD value unless
  the writer is `service_role` or an active admin. Only `/api/auth/verify-otp` (service_role)
  sets them, after a successful OTP.
- `signup` (email) stores a typed number only as `pending_phone` in user_metadata — it is not a
  verified claim and is not readable by `send-otp`'s phone lookup.
- `link-email` updates **email fields only**; it never writes a phone.

## Must be GREEN for SMS OTP login

### 1. Environment (Vercel prod)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (mints sessions via `generateLink`) — server only
- [ ] `AT_USERNAME` (real, not `sandbox`) + `AT_API_KEY` (live) → **no 401**
- [ ] `AT_SENDER_ID` approved (required for delivery in CI and most WA countries)
- [ ] `OTP_PEPPER` set to a long random secret
- [ ] `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Upstash) — otherwise OTP store is per-instance
      memory and breaks on serverless
- [ ] `NEXT_PUBLIC_APP_URL` matches the deployed domain

### 2. Supabase project settings
- [ ] Auth → Email provider enabled (magiclink) — required for the default OTP→session path
- [ ] Auth → URL config: Site URL + Redirect URLs include the prod domain + `/auth/callback`
- [ ] `profiles` table populated with users' phone in **E.164** (`+225...`) and a `linked_email`
- [ ] (Optional Path A) Auth → Phone provider enabled + an SMS provider configured, only if you
      want phone-only accounts without an email

### 3. Africa's Talking account
- [ ] Live application created (not sandbox), account funded
- [ ] API key generated and matches `AT_API_KEY` → test returns `statusCode` 100/101, not 401
- [ ] Sender ID / shortcode approved for Côte d'Ivoire

## Fast diagnostics

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `SMS_PROVIDER_MISSING` (503) | No `AT_API_KEY` (or Twilio/Termii) | Set AT creds on Vercel |
| AT returns **401** | Wrong/inactive AT key or username | Regenerate key, use live username |
| "Si ce numéro est lié…" (400) | Phone not in `profiles` (exact E.164) | Sign up by email, link phone, or seed profile |
| Code accepted but no session | Email provider off, or account has no `linked_email` | Enable email auth; ensure `linked_email` set |
| OTP works locally, fails on Vercel | In-memory OTP store (no KV) | Set `KV_REST_API_*` |
| "Code incorrect ou expiré" always | `OTP_PEPPER` changed between send/verify | Keep pepper stable across deploys |

## Verified in code (2026-07-18)
- OTP: `crypto.randomInt`, SHA-256 + pepper, `timingSafeEqual`, never stored plaintext.
- Rate limiting on send + verify; lockout after 5 attempts; anti-enumeration response.
- Exact E.164 match only (no fuzzy last-9); phone change requires OTP proof (`link-email`).
- `logout` clears the Supabase session; `me` returns profile + linked identity.
- Fixed: removed stray `"use server"` from `app/auth/callback/route.ts` (invalid on a route handler).
