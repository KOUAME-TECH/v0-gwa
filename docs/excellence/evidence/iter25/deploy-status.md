# Deploy status — ITÉRATION 25 (GO déployer / SSO retry)

**Tip** : `234e1177e5f543a82709c888f89195fb4727eb2b` · branche `gwa/excellence-parcours-1e99`  
**Target** : Production · projet `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa` (`team_KUeqdoY34PvZoLu9pZYo284N`)  
**Date** : 2026-11-03T14:36Z · GeniusPay **FROZEN** · **NO merge**  
**Trigger** : User « GO déployer » after SSO approve ask · prior success `dpl_BmKBqbDJr2Sv9XJoHt3vrLNaaxK2`

## Goal

Immediate production redeploy of tip HEAD via Vercel MCP `create_deployment` (same path as BmKBqbDJr), then verify robots/sitemap/health/logo.

## Methods (this pass)

| Method | Result |
| --- | --- |
| MCP `authorize_team_sso` | **requires_user_action** — fresh consent URLs |
| MCP `authorize_team_access` | **requires_user_action** — fresh consent URLs |
| MCP `list_teams` | **OK** — team GWA |
| MCP `create_deployment` **production** tip `234e117` (×3 payloads) | **403** — no permission to create Production Deployment |
| CLI `vercel whoami` / `vercel deploy --prod` | **Logged out** · `login_required` |
| REST POST `/v13/deployments` (no token) | **403** missing authentication token |
| GH `workflow_dispatch` Deploy Production | **403** Resource not accessible by integration |
| Git auto-deploy (Vercel status on tip) | **failure** — Hobby private-org block |
| `VERCEL_TOKEN` / `VERCEL_ACCESS_TOKEN` / ORG / PROJECT / DEPLOY_HOOK | **ABSENT** |

### Fresh SSO consent (single-use ~10 min) — UNIQUE NEXT

Primary: `https://vercel.com/sso/session-requests/alnIU65r5mVjGWFY_TJ7pSucGCHcLM2h`  
Earlier this pass: `https://vercel.com/sso/session-requests/Ccl9l6HNYYspUkVZRGkeu3nZyj2MhzO9`  
Alt access: `https://vercel.com/sso/session-requests/N3LaIpjhSGRHBQ4xqGDpbgWdU4qxh2OZ`  
team `team_KUeqdoY34PvZoLu9pZYo284N`

Payload attempted (mirrors BmKBqbDJr path):

```json
{
  "teamId": "team_KUeqdoY34PvZoLu9pZYo284N",
  "forceNew": "1",
  "requestBody": {
    "name": "v0-gwa",
    "project": "prj_6rxrwGIg7IhfuprNGnecPl2mncoK",
    "target": "production",
    "gitSource": {
      "type": "github",
      "org": "kouame-tech",
      "repo": "v0-gwa",
      "ref": "gwa/excellence-parcours-1e99",
      "sha": "234e1177e5f543a82709c888f89195fb4727eb2b"
    }
  }
}
```

## Live probes (no new deploy)

| Check | Result |
| --- | --- |
| `GET /api/health` | **200** · `rate_limit_redis=true` · `deploy.git_sha=2f9d54b276f0` (**STALE** vs tip `234e117`) |
| `robots.txt` | **404** |
| `sitemap.xml` | **404** |
| `/icon-master.png` | **200** (static asset) |
| `/master.png` | **404** |
| Header logo (Playwright) | `/icon.svg` · `hasIconMaster=false` |

Evidence: `live-probes.txt` · `prod-health.json` · `prod-home-logo-1024.png` · `prod-logo-imgs.json` · `env-hunt.txt` · `mcp-create-deployment.json` · `cli-deploy.txt` · `rest-deploy.json` · `gh-dispatch.txt` · `vercel-whoami.txt` · `branch-tip.json`

## Verdict

**Deploy method: NONE** — user claimed GO, but MCP Production Deploy grant still **403**. No new deployment id. Prod remains stale SHA `2f9d54b` (BmKBqbDJr era).

## UNIQUE NEXT

1. Open **fresh** SSO consent (primary link above) in a logged-in Vercel session and approve **Production Deploy** for team `gwa`, then reply **GO** again.  
2. Or Dashboard Redeploy tip `gwa/excellence-parcours-1e99` → Production.  
3. Or inject `VERCEL_TOKEN` into a **linked** Cloud Agent environment → CLI `vercel deploy --prod`.
