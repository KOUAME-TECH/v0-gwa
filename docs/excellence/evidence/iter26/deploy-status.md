# Deploy status — ITÉRATION 26 (VERCEL_TOKEN UI claim → shell empty)

**Tip** : `44d6f9d5d397348262a8bb3ab72def63de6741cd` · branche `gwa/excellence-parcours-1e99`  
**Target** : Production · projet `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa` (`team_KUeqdoY34PvZoLu9pZYo284N`)  
**Date** : 2026-11-03T14:40Z · GeniusPay **FROZEN** · **NO merge**  
**Trigger** : User confirmed Cloud Agent secret `VERCEL_TOKEN` configured in Cursor Secrets UI

## Goal

Deploy tip HEAD to production for mygwa.org via `$VERCEL_TOKEN` CLI / REST, with MCP `create_deployment` as backup; wait READY; verify robots/sitemap/health/logo.

## Critical finding — token UI ≠ shell injection

| Check | Result |
| --- | --- |
| `[ -n "$VERCEL_TOKEN" ]` | **true** (name present) |
| `${#VERCEL_TOKEN}` | **0** (value empty) |
| `cursor-cloud environment-info` | **`environment: null`** — this run has **no linked environment** |
| Other secret names (`VERCEL_ACCESS_TOKEN`, `Cursor_Agent`, ORG/PROJECT, …) | present names · **len=0** |

**Verdict on secret**: Exists in Secrets UI as claimed, but **not injected into THIS agent run**. User likely needs a **linked** Cloud Agent environment + **new agent chat** after saving the real token value.

## Methods (this pass)

| Method | Result |
| --- | --- |
| CLI `npx vercel deploy --prod --token "$VERCEL_TOKEN" --yes` | **FAIL** — `--token` missing a value (len=0) |
| REST POST `/v13/deployments` Bearer | **403** `missingToken: true` |
| MCP `list_projects` search `v0-gwa` | **OK** — project + team IDs confirmed |
| MCP `create_deployment` **production** tip `44d6f9d` | **403** — no permission to create Production Deployment |
| MCP `authorize_team_sso` | **requires_user_action** — fresh consent URL |
| MCP `authorize_team_access` | **requires_user_action** — fresh consent URL |
| `request-environment-setup-actions` | Recorded `add_secrets` + SSO external action |

### Fresh SSO consent (single-use ~10 min) — UNIQUE NEXT

Primary SSO: `https://vercel.com/sso/session-requests/PT8b5AtE101CMdbfA7Cj8N5KCuSZkR6_`  
Access alt: `https://vercel.com/sso/session-requests/6A_rs3C9gooloZK4JG0QIrPUfYhPfzL0`  
team `team_KUeqdoY34PvZoLu9pZYo284N`

Payload attempted:

```json
{
  "teamId": "team_KUeqdoY34PvZoLu9pZYo284N",
  "forceNew": "1",
  "skipAutoDetectionConfirmation": "1",
  "requestBody": {
    "name": "v0-gwa",
    "project": "prj_6rxrwGIg7IhfuprNGnecPl2mncoK",
    "target": "production",
    "gitSource": {
      "type": "github",
      "org": "kouame-tech",
      "repo": "v0-gwa",
      "ref": "gwa/excellence-parcours-1e99",
      "sha": "44d6f9d5d397348262a8bb3ab72def63de6741cd"
    }
  }
}
```

## Live probes (no new deploy)

| Check | Result |
| --- | --- |
| `GET /api/health` | **200** · `rate_limit_redis=true` · `deploy.git_sha=2f9d54b276f0` (**STALE** vs tip `44d6f9d`) |
| `robots.txt` | **404** |
| `sitemap.xml` | **404** |
| `/` | **200** |
| `/icon.svg` | **200** |
| `/icon-master.png` | **200** (static asset) |
| `/master.png` | **404** |
| Header logo (Playwright) | `/icon.svg` · `hasIconMaster=false` |

Evidence: `live-probes.txt` · `prod-health.json` · `prod-home-logo-1024.png` · `prod-logo-imgs.json` · `env-hunt.txt` · `mcp-create-deployment.json` · `cli-deploy.txt` · `rest-deploy.json` · `vercel-whoami.txt` · `branch-tip.json`

## Return summary

| Field | Value |
| --- | --- |
| **method** | **NONE** (CLI empty token · REST missingToken · MCP 403) |
| **deployment id** | **none** (no new dpl_) |
| **live SHA** | `2f9d54b276f0` (stale) · tip `44d6f9d` not live |
| **HTTP** | robots **404** · sitemap **404** · health **200** · redis **true** |

## UNIQUE NEXT

1. **Link** a Cloud Agent environment, set non-empty `VERCEL_TOKEN`, start a **new** agent chat → `vercel deploy --prod`.  
2. Or open **fresh** SSO consent (primary link above) → approve Production Deploy → reply **GO**.  
3. Or Dashboard Redeploy tip `gwa/excellence-parcours-1e99` @ `44d6f9d` → Production.
