# Using Cursor agents on GWA (solo founder + 2 interns)

Lean guide — **no SDK, no npm deps**. This repo ships with 4 project subagents in
`.cursor/agents/`. Use them from Cursor Composer/Chat to stay on-scope and ship the beta.

## The 4 project agents

| Agent | Use it when… |
|-------|--------------|
| `@gwa-scope-guardian` | You're tempted to add a feature/page/dep. It tells you if it's in F1–F6. |
| `@gwa-beta-ship` | You need to prioritize toward 1 Sept — what to build, cut, or defer. |
| `@gwa-security` | You touch auth, payments, webhooks, RLS, admin, or secrets. |
| `@gwa-scg-factoring` | You work on the SCG score or the affacturage (factoring) flow. |

Invoke by mentioning the agent (e.g. type `@gwa-security`) or ask Cursor to "use the
gwa-security agent to review this change".

## Daily workflow (recommended)

1. **Plan** with `@gwa-beta-ship`: "What's the highest-priority critical-path task today?"
2. **Scope-check** any new idea with `@gwa-scope-guardian` before writing code.
3. **Build** the leanest version. Keep changes small and reviewable.
4. **Review** auth/payment/admin changes with `@gwa-security` before merging.
5. **Verify** against `docs/ops-go-live.md` (GO/NO-GO) and `docs/ops-auth.md`.

## Good prompts to copy/paste

```
@gwa-beta-ship We have 6 weeks to 1 Sept. Given the critical path, what are the top 3
tasks this week and what should I explicitly NOT work on?
```

```
@gwa-scope-guardian A user asked for an artisan/handicraft catalog. In or out of scope?
Give me the response to send them.
```

```
@gwa-security Review my changes to app/api/orders and the Feexpay webhook for payment
tampering and replay. Flag Critical vs Should-fix.
```

```
@gwa-scg-factoring I want to change the SCG bancable threshold. Walk me through the
impact and the audit-trail requirements for the factoring decision.
```

## For interns (when onboarded)

- Start every task by reading `docs/scope-beta.md` and `docs/architecture.md`.
- Before adding anything, ask `@gwa-scope-guardian`. If it says out-of-scope, stop.
- One route's status = one line in `lib/routes/inventory.ts`. Keep it truthful.
- Never put secrets in `NEXT_PUBLIC_*`; never commit `.env.local`.
- Ask `@gwa-security` to review any PR that touches auth, payments, or admin.

## Why no SDK

For a solo dev + 2 interns, the Composer agents above cover planning, scope, security,
and domain review with zero maintenance. Add the Cursor CLI/SDK later only if you need
non-interactive CI automation (e.g. scripted reviews on every PR) — not needed for beta.
