# Flotte d’agents Cursor — GWA (signal fort)

Mode **A — Sentinelle** : diagnostique, commente, propose ; pas de merge auto finance.
Canaux : **GitHub** (PR comment / check) + **Slack** (alertes uniquement).

## Agents

| Agent | Trigger | Outils | Notifie si |
|-------|---------|--------|------------|
| **QA Full (hub)** | PR merged → `main` | tests, smoke, inventory, Notion, Slack | FAIL page/fonction ou proposition **P0** |
| **Security** | PR merged → `main` | revue auth/RLS/PII, advisors | Finding critique |
| **Scope** | PR opened/merged | `docs/scope-beta.md`, inventory | Hors F1–F6 |
| **Health** | Cron quotidien ~07:00 | `/api/health`, smoke | Status ≠ healthy |
| **Notion** | PR merged → `main` | Notion MCP | Échec sync seulement |

## Règles QA Full

1. Tester **toutes** les pages/fonctions F1–F6 (PASS/FAIL/SKIP + preuve).
2. Proposer améliorations normes strictes (OWASP, WCAG 2.2 AA, UX 2G/3G, fintech) en tâches P0–P2.
3. Spawn agent spécialisé = **PR de spec** + tâche Notion — validation humaine (+2/mois max).

## Setup

1. Créer chaque automation dans Cursor Automations (repo `MYSTERE-arch/v0-gwa`).
2. Copier le prompt depuis `docs/agents/<agent>.prompt.md`.
3. Brancher Slack `#gwa-alerts` (ou canal choisi).
4. QA Full en premier, puis Security, Scope, Health, Notion.

Prompts versionnés :
- `docs/agents/qa-full.prompt.md`
- `docs/agents/security.prompt.md`
- `docs/agents/scope.prompt.md`
- `docs/agents/health.prompt.md`
- `docs/agents/notion.prompt.md`

## Anti-bruit

Pas de message « tout va bien ». Succès = silence.
