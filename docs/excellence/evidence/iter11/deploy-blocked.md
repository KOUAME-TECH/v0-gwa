# Deploy blocked (iter 11)

| Channel | Result |
| --- | --- |
| Vercel MCP `create_deployment` preview | 403 forbidden |
| Vercel MCP `create_deployment` production | 403 forbidden |
| Vercel CLI `whoami` | login_required (no VERCEL_TOKEN) |
| GitHub Actions `workflow_dispatch` Deploy Production | 403 Resource not accessible by integration |
| Prod SHA | still `2f9d54b` · robots/sitemap **404** |

**UNIQUE NEXT**: restore deploy capability (Vercel token/MCP write scope or human Dashboard Redeploy of `gwa/excellence-parcours-1e99`) then re-curl `/robots.txt` + `/sitemap.xml` expect 200.
