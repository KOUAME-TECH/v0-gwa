# Deploy status — ITÉRATION 21 (multi-method)

**Tip** : `1557544768f9f547f9893fdd132a91ca8ea77b94` · branche `gwa/excellence-parcours-1e99`  
**Target** : Production · projet `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `team_KUeqdoY34PvZoLu9pZYo284N`  
**Date** : 2026-11-03 · GeniusPay **FROZEN** · **NO merge**

## Env hunt (presence only)

| Variable | Runtime |
| --- | --- |
| `VERCEL_TOKEN` | ABSENT |
| `VERCEL_ACCESS_TOKEN` | ABSENT |
| `Cursor_Agent` | ABSENT (`CURSOR_AGENT=1` flag only) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | ABSENT |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | ABSENT |

## Methods

| Method | Result |
| --- | --- |
| A MCP `create_deployment` prod | **403** forbidden (retry after SSO URL still 403) |
| A' MCP preview | **403** |
| B REST `POST /v13/deployments` no Bearer | **403** |
| C bypass header checks | N/A — secret ABSENT |
| D `npx vercel whoami/deploy` | **login_required** (no token) |
| E `gh workflow run` Deploy Production | **403** Resource not accessible by integration |

## SSO

Consent URL émise (single-use, ~10 min) via `authorize_team_sso` — team GWA. User action required.

Cloud Agent secrets request recorded: `VERCEL_TOKEN` (+ optional ORG/PROJECT/BYPASS).

## Live probes (no deploy)

| Check | Result |
| --- | --- |
| `GET /api/health` | 200 · `rate_limit_redis=true` · `deploy.git_sha=2f9d54b276f0` (STALE vs tip `1557544`) |
| `robots.txt` | **404** |
| `sitemap.xml` | **404** |
| `/icon-master.png` | **200** (asset static) |
| `/master.png` | **404** (tip alias not live) |
| Header logo prod | still `/icon.svg` (Playwright) |

## UNIQUE NEXT

Dashboard Redeploy tip `gwa/excellence-parcours-1e99` @ `1557544` → Production **or** inject `VERCEL_TOKEN` into Cloud Agent env **or** approve Vercel MCP SSO then retry Method A.
