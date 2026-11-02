# Deploy status — tip `c1c1776`+ (Mission 1 unblock)

**Date** : 2026-11-02T21:05Z  
**Branche** : `gwa/excellence-parcours-1e99` (tip post-commit — voir git log)  
**Projet** : Vercel `v0-gwa` · team `gwa` (`team_KUeqdoY34PvZoLu9pZYo284N`) · prod https://mygwa.org

---

## Channels tried (this agent)

| Channel | Result |
| --- | --- |
| Vercel MCP `list_teams` / `list_projects` | OK — team GWA + projet `v0-gwa` visibles |
| Vercel MCP `create_deployment` production | **403** — no permission to create Production Deployment |
| Vercel MCP `create_deployment` preview | **403** — no permission to create Preview Deployment |
| Vercel MCP redeploy `dpl_BmKBqbDJr2Sv9XJoHt3vrLNaaxK2` | **404** not_found |
| Vercel MCP `list_deployments` | **403** |
| Vercel MCP `authorize_team_sso` / `authorize_team_access` | **requires_user_action** — consent links issued |
| Vercel CLI `whoami` | Logged out · no `VERCEL_TOKEN` in env |
| GitHub Actions `workflow_dispatch` Deploy Production | **403** Resource not accessible by integration |

---

## Fresh SSO consent (UNIQUE NEXT)

Open **one** of these (single-use, ~10 min) then reply so agent retries deploy:

1. https://vercel.com/sso/session-requests/Ente0FZHhZmOF_0p9B0ON2QJC73E3lQp *(latest)*  
2. https://vercel.com/sso/session-requests/t6MuOlvXxhdYUJRRDxMf24I1iv0XHHzE  
3. https://vercel.com/sso/session-requests/qxRqelkm47awmUa7EQpI95u2TW21PPSq  
4. https://vercel.com/sso/session-requests/SsrEUHyx6QUmByo7gYPjOicVuPXHlsR4  

Or Dashboard → Redeploy branch `gwa/excellence-parcours-1e99` → Production.  
Or add env secret `VERCEL_TOKEN` (team `gwa`, deploy scope).

---

## Prod probes (stale until tip deploy)

| Check | Result |
| --- | --- |
| `deploy.git_sha` | **`2f9d54b276f0`** |
| `GET /robots.txt` | **404** |
| `GET /sitemap.xml` | **404** |
| `resilience.rate_limit_redis` | **`true`** (Redis intact — do not break `KV_REST_*`) |

Evidence : `iter14/prod-health.json` · `iter14/robots-prod.status` · `security/prod-headers-2026-11-02.txt`

---

## Dashboard steps (si SSO expiré)

1. https://vercel.com/gwa/v0-gwa → Deployments  
2. Find commit on `gwa/excellence-parcours-1e99` → ⋮ → Promote to Production / Redeploy  
3. `curl -I https://mygwa.org/robots.txt` expect **200**  
4. `curl -sS https://mygwa.org/api/health` → `rate_limit_redis:true`

```bash
# CLI fallback (after vercel login OR VERCEL_TOKEN)
npx vercel deploy --prod --scope gwa --yes
```

Pas de merge. GeniusPay/FeexPay **FROZEN**.
