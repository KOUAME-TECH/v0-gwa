# Deploy status — tip `f88d186` (Mission 1, 2026-11-03)

**Branche** : `gwa/excellence-parcours-1e99`  
**Projet** : Vercel `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa` (`team_KUeqdoY34PvZoLu9pZYo284N`)  
**Prod** : https://mygwa.org

## Token hunt (presence only)

| Source | Result |
| --- | --- |
| Shell `VERCEL_TOKEN` | **[missing]** |
| Shell `VERCEL_ACCESS_TOKEN` | **[missing]** |
| Shell `VERCEL_OIDC_TOKEN` | **[missing]** |
| `.env` / `.env.local` / vercel auth.json | **[missing]** |
| `gh secret list` | **403** Resource not accessible by integration |
| Vercel MCP `filter_project_envs` | **404** (team grant expired / project not visible without SSO) |
| Cloud Agent environment secrets | no linked environment · no VERCEL_* injected |

## Deploy attempts

| Channel | Result |
| --- | --- |
| Vercel MCP `create_deployment` production (gitSource tip) | **403** no permission to create Production Deployment |
| Vercel MCP `authorize_team_sso` / `authorize_team_access` | **requires_user_action** — consent links issued |
| Vercel CLI `whoami` | Logged out |
| GH Actions `workflow_dispatch` Deploy Production | **403** Resource not accessible by integration |

## Fresh SSO consent (UNIQUE NEXT — human)

Open **one** (single-use, ~10 min) then reply so agent retries deploy:

1. https://vercel.com/sso/session-requests/33zhPPeVTZ1hD6V_f2ZN9M2WcPq6N_VU  
2. https://vercel.com/sso/session-requests/Nc3yG48fNlUYfebabCLYHcKUcwOxvAEz  

**Preferred UNIQUE NEXT** (token path this mission): paste Access Token into **Cloud Agent secret** or **GitHub Actions secret** named `VERCEL_TOKEN` (team `gwa`, deploy scope) — **not** into chat. Project env alone does **not** inject into the agent shell.

Also: Dashboard Redeploy tip `gwa/excellence-parcours-1e99` → Production, or upgrade Pro (Hobby blocks private-org Git auto-deploy).

## Prod probes (stale until tip deploy)

| Check | Result |
| --- | --- |
| `deploy.git_sha` | **`2f9d54b276f0`** |
| `GET /robots.txt` | **404** |
| `GET /sitemap.xml` | **404** |
| `resilience.rate_limit_redis` | **`true`** |
| Upstash `gwa-prod` PING | **PONG** |

Evidence: `prod-health.json` · `robots-prod.status` · `sitemap-prod.status` · `redis-ping.txt`

Pas de merge PR #27. GeniusPay/FeexPay **FROZEN**.
