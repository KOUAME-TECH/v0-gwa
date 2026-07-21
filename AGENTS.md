# AGENTS.md

## Cursor Cloud specific instructions

GWA Platform is a **single Next.js 16 (App Router) PWA** — not a monorepo. It is a French-language
agro-food marketplace for Côte d'Ivoire. There is one runnable service (the Next.js app) plus one
required backend dependency (**Supabase**: Auth + Postgres + Storage + Realtime).

### Commands (see `package.json` scripts)
- Dev server: `npm run dev` → http://localhost:3000 (Turbopack). This is the way to run the app.
- Tests: `npm run test` (Vitest, ~82 unit tests). These are pure-function unit tests and need **no
  backend / no env vars** — they run standalone.
- Build: `npm run build` (production build; `next.config.mjs` sets `typescript.ignoreBuildErrors`).
- Lint is **currently broken**: `npm run lint` runs `eslint .`, but `eslint` is **not** in
  `devDependencies` and there is **no ESLint config** in the repo, so it fails with
  `eslint: not found`. Treat lint as not set up (do not assume it works).

### The app requires Supabase to render anything
`middleware.ts` calls `supabase.auth.getUser()` on nearly every request, so without
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` every page 500s. Put credentials in
`.env.local` (gitignored). Also commonly needed: `SUPABASE_SERVICE_ROLE_KEY` (admin/OTP/webhooks),
`OTP_PEPPER` (any value locally), `ALLOW_PAYMENT_SIMULATION=true` (dev escrow). SMS OTP
(Africa's Talking/Twilio/Termii), OneSignal push, Feexpay payments, and AgentMail are all optional.

Two backend options:
- **Hosted Supabase project (recommended)** — its `https://*.supabase.co` URL matches the app's CSP
  (see below), so all in-browser flows work with zero code changes.
- **Local Supabase** (`supabase start`, needs Docker) — great for server-side/SSR/API testing, but
  the strict CSP blocks browser→local-Supabase calls (see below).

### CSP gotcha (non-obvious, bites in-browser local dev)
`next.config.mjs` sets a strict `Content-Security-Policy` whose `connect-src` only allows
`https://*.supabase.co` (plus `'self'`). **Client-side** Supabase calls — e.g. the marketplace
product list (`app/marketplace/page.tsx`), email login/signup via the browser client
(`lib/supabase/client.ts`) — are **blocked by the browser** when `NEXT_PUBLIC_SUPABASE_URL` points at
a local `http://127.0.0.1:54321` Supabase (marketplace shows "Pas encore de produits", login/signup
silently fail). Server-side (SSR pages, `app/api/*`, middleware) is unaffected. To exercise browser
flows against a **local** Supabase, temporarily add the local origin to `connect-src` in
`next.config.mjs` (requires a dev-server restart) and **do not commit it** — or just use a hosted
`*.supabase.co` project.

### Applying the SQL schema to a fresh (local) Postgres — known gaps
`scripts/schema/*.sql` (apply in numeric order) is a retrofitted snapshot, not a clean linear
migration history. On a brand-new database:
- Apply **per-statement-tolerant** (do not abort the whole run on the first error).
- `006_seed_categories_settings.sql` seeds legacy `art` categories that violate the current
  `category_type` check (only `agriculture`/`artisanat`) — safe to skip.
- `profiles.linked_email` and `profiles.onesignal_player_id` are referenced by app code and by
  migrations 027/037 but are **never created** by any script — add them manually
  (`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linked_email text;` and `... onesignal_player_id text;`).
- Functions `promote_to_admin(text,text)` and `is_room_member(text)` are referenced (026) but never
  defined — safe to ignore for catalog/auth flows.
- **Anon "permission denied for table ..."**: local Postgres default privileges do NOT grant
  SELECT/INSERT/UPDATE/DELETE to `anon`/`authenticated` (hosted Supabase does). RLS is enabled but
  runs *after* table grants, so you must apply the standard Supabase baseline grants
  (`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;` plus
  sequence usage and matching `ALTER DEFAULT PRIVILEGES`), then re-run the hardening migrations
  (026/027/035/037) to restore column-level restrictions.

### Data / auth notes
- `profiles.user_type` allowed DB values are `producteur` / `acheteur` / `cooperative`. UI values
  (`farmer`/`buyer`/...) are mapped by `USER_TYPE_MAP` in `lib/auth/post-auth.ts` before writing.
- With Supabase email confirmations disabled (`[auth.email] enable_confirmations = false`), browser
  email signup auto-confirms and returns a session immediately → redirects to `/profil` (good for a
  quick end-to-end signup test).
- Route/status inventory: `lib/routes/inventory.ts` or `/dev/routes` (blocked in production).
