# GitHub MCP attempt — ITÉRATION 22

**Date** : 2026-11-03T14:10Z · Repo `KOUAME-TECH/v0-gwa`  
**Branch tip** : `a77413e46ff8a3e9ded094d05d43ab8157e7920a` (`gwa/excellence-parcours-1e99`)  
**Prior tip cited** : `1557544768f9f547f9893fdd132a91ca8ea77b94` (still not live)  
**PR** : [#27](https://github.com/KOUAME-TECH/v0-gwa/pull/27) OPEN · NO merge · GeniusPay **FROZEN**

## 1. GitHub MCP discovery

| Step | Result |
| --- | --- |
| `GetDynamicTools(namespace=Github)` | `namespaceStatus=error` — *"This MCP server failed during live tool discovery. Its tools are unavailable until the connection is fixed."* |
| Tools exposed | **only** `mcp_auth` (schema: empty object) |
| Expected tools | Not discoverable (no `list_workflows`, `run_workflow`, `create_workflow_dispatch`, `list_pull_requests`, `get_file_contents`, etc.) |
| `CallDynamicTool(Github/mcp_auth)` ×2 | **FAIL** — `Interaction query handler is not initialized` (no interactive auth UI in this Cloud Agent run) |
| Re-discovery after auth attempt | Still `namespaceStatus=error` · only `mcp_auth` |

**MCP write/dispatch path: blocked.** No workflow_dispatch tool could be invoked via GitHub MCP.

## 2. gh CLI fallback (MCP-missing op)

| Op | Result |
| --- | --- |
| List workflows | **OK** (read) — see `workflows-readable.json` |
| Workflow `Deploy Production (Vercel)` | id `341933505` · path `.github/workflows/vercel-production.yml` · `workflow_dispatch:` present · triggers also `push`→`main` |
| Recent runs | Last 5+ all **failure** on `main` push (e.g. run `41490501100`) |
| `POST .../actions/workflows/341933505/dispatches` `ref=gwa/excellence-parcours-1e99` | **HTTP 403** — `Resource not accessible by integration` · header requires `actions=write` |
| New run after dispatch | **None** (dispatch rejected) |

Failure root on last successful-trigger path (when Actions *did* run on `main`):  
`vercel pull --token=` → **"You defined --token, but it's missing a value"** — GitHub Actions secrets `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` empty/absent. (Values not printed.)

## 3. PR #27 / Vercel Git status (read)

| Check | State |
| --- | --- |
| Vercel (Git) | **FAILURE** — *"Cannot deploy from a private GitHub organization repository on the Hobby plan"* (`upgradeToPro=github-private-org-to-hobby`) |
| Vercel Deployments – GWA | **FAILURE** — blocked/error for SHA `a77413e…` |
| Supabase Preview | SKIPPED |

## 4. Live probes (no deploy occurred)

| URL | Code | Note |
| --- | --- | --- |
| `GET /api/health` | 200 | `deploy.git_sha=2f9d54b276f0` · **STALE** vs tip `a77413e` / prior `1557544` |
| `GET /robots.txt` | **404** | unchanged |
| `GET /sitemap.xml` | **404** | unchanged |
| `GET /` | 200 | `x-vercel-cache: HIT` · age ~4h |
| `GET /master.png` | 404 | tip asset not live |
| `GET /icon-master.png` | 200 | older static |

## 5. MCP tools effectively usable this run

| Namespace | Usable tools | Notes |
| --- | --- | --- |
| `Github` | **none** (only broken `mcp_auth`) | Discovery error · auth interaction handler uninitialized |
| gh CLI (fallback) | workflows list, run list, PR view, failed logs (read) | **No** `actions:write` · dispatch 403 |

## UNIQUE NEXT

1. **Dashboard** Redeploy Production from tip `gwa/excellence-parcours-1e99` @ `a77413e` (or at least past `1557544`), **or**
2. Inject **`VERCEL_TOKEN`** (+ `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`) into **GitHub Actions secrets** *and* grant Cloud Agent / `gh` token **`actions:write`**, then re-dispatch `Deploy Production (Vercel)`, **or**
3. Re-auth **GitHub MCP** in Cursor (interactive) once discovery is fixed — then retry MCP `run_workflow` / dispatch, **and**
4. Vercel Git integration remains blocked on **Hobby + private org** until Pro upgrade or manual Dashboard deploy (bypasses Git app).

Do **not** merge PR #27. GeniusPay frozen.
