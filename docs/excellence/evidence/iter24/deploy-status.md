# Deploy status — ITÉRATION 24 (MCP path replay vs BmKBqbDJr)

**Tip** : `70b0d455b394dc2739b3185b4b13e9340da92c81` · branche `gwa/excellence-parcours-1e99`  
**Target** : Production · projet `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa` (`team_KUeqdoY34PvZoLu9pZYo284N`)  
**Date** : 2026-11-03T14:31Z · GeniusPay **FROZEN** · **NO merge**  
**Cloud run** : `bc-96521ee5-b175-5704-86a1-4b164e0eb799` · **linked environment = null**

## Goal

Rejouer le chemin qui a produit **`dpl_BmKBqbDJr2Sv9XJoHt3vrLNaaxK2`** (~18h) : Vercel MCP `create_deployment` (gitSource) → **production**, tip HEAD, sans aide utilisateur si le grant SSO était encore valide.

## Methods (this pass)

| Method | Result |
| --- | --- |
| MCP `list_teams` | **OK** — team GWA `team_KUeqdoY34PvZoLu9pZYo284N` |
| MCP `list_projects` search `v0-gwa` | **empty** (grant insuffisant pour list) |
| MCP `get_project` / `get_deployment` BmKBqbDJr | **404** |
| MCP `list_deployments` | **403** |
| MCP `create_deployment` **production** tip `70b0d45` (×4 retries) | **403** — no permission to create Production Deployment |
| MCP `create_deployment` **preview** | **403** — no permission to create Preview Deployment |
| MCP redeploy `dpl_BmKBqbDJr…` + `withLatestCommit` | **404** Deployment not found |
| MCP `authorize_team_sso` / `authorize_team_access` | **requires_user_action** — consent URLs émises |
| Playwright open SSO consent URL | redirects to **Vercel login** (no session in agent browser) |
| CLI `vercel whoami` | **Logged out** · `VERCEL_TOKEN` **ABSENT** |
| GH `workflow_dispatch` Deploy Production | **403** Resource not accessible by integration |
| Git auto-deploy (Vercel status on tip) | **failure** — Hobby private-org block |

### Fresh SSO consent (single-use ~10 min)

`https://vercel.com/sso/session-requests/9xwWvkC3dmbuaGn1cch0YnFt0ONZMpyu`  
team `team_KUeqdoY34PvZoLu9pZYo284N` · expiresAt ~1793716882397

Payload mirrored for successful prior path (evidence `mcp-create-deployment.json`):

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
      "sha": "70b0d455b394dc2739b3185b4b13e9340da92c81"
    }
  }
}
```

## Live probes (no new deploy)

| Check | Result |
| --- | --- |
| `GET /api/health` | **200** · `rate_limit_redis=true` · `deploy.git_sha=2f9d54b276f0` (**STALE** vs tip `70b0d45`) |
| `robots.txt` | **404** |
| `sitemap.xml` | **404** |
| `/icon-master.png` | **200** (static asset) |
| `/master.png` | **404** |
| Header logo (Playwright) | `/icon.svg` · `hasIconMaster=false` |

Evidence: `live-probes.txt` · `prod-health.json` · `prod-home-logo-1024.png` · `prod-logo-imgs.json` · `env-hunt.txt` · `mcp-create-deployment.json` · `github-vercel-status.json` · `vercel-whoami.txt`

## Verdict

**Deploy method: NONE** — prior MCP SSO grant for Production Deploy is **not** valid on this connection. Aggressive retries (prod/preview/redeploy) all fail. No new deployment id. Prod remains `BmKBqbDJr` / SHA `2f9d54b`.

## UNIQUE NEXT

1. Approve MCP SSO consent (link above) with Production Deploy permission → agent retries `create_deployment`.  
2. Or re-save `VERCEL_TOKEN` on a **linked** Cloud Agent environment → CLI `vercel deploy --prod`.  
3. Or Dashboard Redeploy tip `gwa/excellence-parcours-1e99` → Production.
