# Deploy status — tip `3377cc5` (Mission Cursor_Agent hunt, 2026-11-03)

**Branche** : `gwa/excellence-parcours-1e99`  
**Remote tip SHA** : `3377cc5d09815017f0611d81a3da0c415f418f70`  
**Projet** : Vercel `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa` (`team_KUeqdoY34PvZoLu9pZYo284N`)  
**Prod** : https://mygwa.org  
**PR merge** : **not done** (explicit) · GeniusPay **FROZEN**

## Token hunt (presence only — values never printed)

Clarification: user Access Token is named **`Cursor_Agent`** (not necessarily `VERCEL_TOKEN`).

| Source | Result |
| --- | --- |
| Shell `Cursor_Agent` | **[missing]** |
| Shell `CURSOR_AGENT` | **SET but len=1** (platform flag `1`, not a Vercel token) |
| Shell `cursor_agent` | **[missing]** |
| Shell `VERCEL_TOKEN` | **[missing]** |
| Shell `VERCEL_ACCESS_TOKEN` | **[missing]** |
| `env \| grep -iE 'cursor\|vercel\|token'` | only Cursor platform vars (`CURSOR_*`, `AGENT_TRANSCRIPTS`) — no Vercel access token |
| Process environ scan | same: `CURSOR_AGENT=SET` (flag) only |
| Cloud Agent linked environment | **null** — no environment secrets injected |
| Local `.env` / `.env.local` | **[missing]** (only `.env.example`, no Vercel token keys with values) |
| Vercel CLI `~/.local/share/com.vercel.cli/auth.json` | **[missing]** · CLI logged out · `vercel` not on PATH (npx available) |
| `gh secret list` / Actions secrets API | **403** Resource not accessible by integration |
| `gh variable list` | **403** |
| Vercel MCP `filter_project_envs` (`Cursor_Agent` name hunt) | **404** project not visible (team grant / SSO) |
| Vercel MCP `list_projects` search `v0-gwa` | empty (0 projects) despite `list_teams` seeing `gwa` |
| Agent store `/cursor/stores/self` | Redis creds only — **no** Vercel / Cursor_Agent token |

**Verdict: token NOT found in agent runtime.**

## Deploy attempts (this pass)

| Channel | Result |
| --- | --- |
| Vercel MCP `create_deployment` production · ref `gwa/excellence-parcours-1e99` · sha `3377cc5…` | **403** no permission to create Production Deployment |
| Vercel MCP `get_project` / `filter_project_envs` | **404** |
| Vercel MCP `list_deployments` | **403** |
| Vercel MCP `authorize_team_sso` | **requires_user_action** (fresh link below) |
| Vercel MCP `authorize_team_access` | **requires_user_action** (fresh link below) |
| Vercel CLI `vercel deploy --prod --token` | **blocked** — no token to export as `VERCEL_TOKEN` |
| GH Actions `secrets.VERCEL_TOKEN` workflow | cannot list/trigger secrets (**403**) |

## Fresh SSO consent (optional parallel path)

Open **one** (single-use, ~10 min) then reply so agent retries MCP deploy:

1. https://vercel.com/sso/session-requests/et_qEPTrYeBOUekSbROjQ6IKzLvYOEUF  
2. https://vercel.com/sso/session-requests/mv4tOX9mQlniD2PwGg12z2oPLGQ-OFS4  

## UNIQUE NEXT (preferred)

Add **Cloud Agent secret** literally named **`Cursor_Agent`** **OR** **`VERCEL_TOKEN`** with the existing Vercel Access Token value (token already named Cursor_Agent in Vercel dashboard — map it into agent secrets). Do **not** paste into chat.

Alternate: Dashboard Redeploy tip `gwa/excellence-parcours-1e99` @ `3377cc5` → Production.

Note: Vercel **project** env named `Cursor_Agent` does **not** inject into the agent shell.

## Prod probes (stale — tip not deployed)

| Check | Result |
| --- | --- |
| Live `deploy.git_sha` | **`2f9d54b276f0`** (≠ tip `3377cc5`) |
| `GET /robots.txt` | **404** (HTML app shell) |
| `GET /sitemap.xml` | **404** (HTML app shell) |
| `resilience.rate_limit_redis` | **`true`** |

Evidence: `prod-health.json` · `robots-prod.status` · `sitemap-prod.status` · `prod-headers.txt`

Parallel: another agent may be landing `orders.currency` + logo PNGs on this branch — deploy after fetch of remote tip; this commit is docs-only.
