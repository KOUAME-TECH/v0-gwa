# Deploy blocked (iter 11 → follow-up tip `39c6900`)

| Channel | Result |
| --- | --- |
| Vercel MCP `create_deployment` preview | 403 forbidden |
| Vercel MCP `create_deployment` production | 403 forbidden |
| Vercel MCP `authorize_team_access` | consent link issued (expires ~10 min) |
| Vercel CLI `whoami` | login_required (no VERCEL_TOKEN) |
| GitHub Actions `workflow_dispatch` Deploy Production | 403 Resource not accessible by integration |
| Prod SHA | still `2f9d54b` · robots/sitemap **404** · Redis `rate_limit_redis:true` |

See also: `docs/excellence/evidence/iter11/deploy-status.md`.

**UNIQUE NEXT**: open fresh SSO consent URL in `deploy-status.md` (or Dashboard Redeploy / `VERCEL_TOKEN`), then re-curl `/robots.txt` + `/sitemap.xml` expect 200.
