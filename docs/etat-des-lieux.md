# État des lieux GWA — 20 juil. 2026

## Surfaces

| Surface | État |
|---------|------|
| GitHub `main` | À jour (PR #3 merged) + branche `cursor/pwa-icon-cleanup-f056` |
| Prod PWA | https://v0-gwa-mu.vercel.app |
| Supabase | Projet `frorfexbcyfbydkiwxqv` — migrations `035` appliquée ; `036`/`037` fichiers prêts |
| Tests | 53 Vitest (suite étendue sur branche icon) |

## Nettoyage effectué

Supprimé (inutilisés) :
- `debug-d90786.log`, `.cursor/debug-d90786.log`
- `public/placeholder.jpg`, `placeholder-logo.png/.svg`, `placeholder-user.jpg`
- `public/icon-dark-32x32.png`, `icon-light-32x32.png`

Conservé :
- `public/placeholder.svg` (fallback images produit/avatar partout)
- OneSignal workers, `sw.js`, manifest

## Architecture (monolithe)

- **Web/Admin** : Next.js App Router + API routes
- **DB** : Supabase Postgres + RLS
- **Paiement** : Feexpay (checkout encore partiel)
- **Auth** : email + OTP SMS (AT 401 = bloqueur humain)
- **SCG** : v1 TS ; v2 FastAPI documenté post-bêta

## Stack agents (signal fort)

Voir `docs/agents-fleet.md` + prompts `docs/agents/*.prompt.md`.

| Agent | Rôle |
|-------|------|
| QA Full | Hub tests pages/fonctions + propositions P0 |
| Security | RLS/PII/Auth |
| Scope | F1–F6 only |
| Health | `/api/health` quotidien |
| Notion | Sync décisions |

## Bloqueurs GO (humains)

1. HIBP toggle Supabase Dashboard
2. Africa’s Talking SMS live
3. Feexpay merchant checkout URL
4. Appliquer SQL `036` en prod

## Sécurité (revue flash post-merge)

| Point | Verdict |
|-------|---------|
| Factoring role gate | OK |
| Admin users service role | OK |
| Rate limit admin 20 | OK |
| RPC admin revoked (035) | OK |
| profiles PII cross-user | **À appliquer 037** post-bêta |
| Middleware /admin session-only | Acceptable bêta ; defense-in-depth later |
| HIBP | Code prêt, toggle manuel |

## Icône PWA

Nouvelle marque **G + grain or** sur fond `#1F5C2E` (Harmattan). Fichiers : `icon-192/512.png`, `apple-icon.png`, `icon.svg`. Cache SW `gwa-v3-icon`.
