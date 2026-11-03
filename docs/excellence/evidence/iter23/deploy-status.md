# Deploy status — ITÉRATION 23 (VERCEL_TOKEN hunt + MCP retry)

**Tip at start** : `71d3e6b306be048c09646e9c9fbee6505e591f17` · branche `gwa/excellence-parcours-1e99`  
**Target** : Production · projet `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `team_KUeqdoY34PvZoLu9pZYo284N`  
**Date** : 2026-11-03T14:12Z · GeniusPay **FROZEN** · **NO merge**  
**Cloud run** : `bc-2d537640-476e-531a-9c3c-09a3a0e1b6ce` · **linked environment = null** (secrets non injectés)

## Env hunt (presence + length only)

| Variable | Runtime |
| --- | --- |
| `VERCEL_TOKEN` | **ABSENT** |
| `VERCEL_ACCESS_TOKEN` | **ABSENT** |
| `Cursor_Agent` | **ABSENT** |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | **ABSENT** |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | **ABSENT** |
| `CURSOR_AGENT` | present len=1 (flag only) |

`.env.local` keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` only — no Vercel token.  
CLI: `npx vercel whoami` → **Logged out**.  
Prior env-setup notes: user previously **skipped** `Cursor_Agent` / `VERCEL_TOKEN` injection.

## Methods (this pass)

| Method | Result |
| --- | --- |
| A MCP `list_projects` search `v0-gwa` | **OK** — project + team ids resolved |
| A MCP `create_deployment` **production** tip `a77413e`… | **403** — no permission to create Production Deployment |
| A' MCP `create_deployment` **preview** | **403** — no permission to create Preview Deployment |
| A'' MCP `list_deployments` | **403** |
| A''' MCP `get_auth_user` | **404** user not found |
| SSO `authorize_team_sso` | consent URL issued (single-use ~10 min) — user action required |
| B REST `POST /v13/deployments` no Bearer | **403** (see `rest-deploy.json`) |
| C bypass header | N/A — secret ABSENT |
| D `vercel deploy --prod --token` | **impossible** — token ABSENT / login_required |
| E GH workflow_dispatch | **not attempted** (avoid conflict with other agent; prefer token path) |

## Live probes (no new deploy)

| Check | Result |
| --- | --- |
| `GET /api/health` | **200** · `rate_limit_redis=true` · `deploy.git_sha=2f9d54b276f0` (**STALE** vs tip `71d3e6b`) |
| `robots.txt` | **404** |
| `sitemap.xml` | **404** |
| `/icon-master.png` | **200** (static asset) |
| `/master.png` | **404** |
| Header logo (Playwright) | still `/icon.svg` · `hasIconMaster=false` |

Evidence: `live-probes.txt` · `prod-health.json` · `prod-home-logo-1024.png` · `prod-logo-imgs.json` · `env-hunt.txt`

## Verdict

**Deploy method: NONE** — `VERCEL_TOKEN` **not present** in this Cloud Agent runtime.  
User belief that the token is available does **not** match process env; this run also has **no linked Cursor environment**, so saved Cloud Agent secrets would not inject here even if re-saved on another environment.

## UNIQUE NEXT

1. Re-save Cloud Agent secret named exactly **`VERCEL_TOKEN`** on an environment **linked to this agent**, then retry `vercel deploy --prod --token "$VERCEL_TOKEN" --yes`.  
2. Or approve MCP SSO consent + Production Deploy permission, then retry Method A.  
3. Or Vercel Dashboard → `v0-gwa` → Redeploy branch tip → Production.
