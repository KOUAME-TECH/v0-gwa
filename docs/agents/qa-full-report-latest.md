# Rapport QA Full — run 2026-07-20T04:40Z

Mode sentinelle. Environnement : Vitest local + smoke prod `v0-gwa-mu.vercel.app`.

## Suite unitaire
- **PASS** — 13 files / **53 tests**

## Smoke HTTP prod

| Path | Status |
|------|--------|
| `/api/health` | PASS 200 healthy, db connected |
| `/` | PASS 200 |
| `/agriculture` | PASS 200 |
| `/download` | PASS 200 |
| `/manifest.json` | PASS 200 |
| `/icon-192.png` | PASS 200 |
| `/conditions` | PASS 200 |
| `/confidentialite` | PASS 200 |
| `/auth/login` | PASS 200 |

## Propositions P0 (déjà trackées, pas de ping)
- Activer HIBP Dashboard
- AT SMS 401
- Feexpay checkout
- Appliquer SQL 036

## Signal
Aucun FAIL bloquant sur ce run → **silence Slack** (règle signal fort).
