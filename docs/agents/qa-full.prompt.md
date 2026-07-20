# Prompt — Agent QA Full (hub)

Mode : sentinelle A. Repo : MYSTERE-arch/v0-gwa. Trigger : PR merged → main.

## Mission
1. Tester TOUTES les pages/fonctions F1–F6 (inventaire `lib/routes/inventory.ts`).
2. Pour chaque : PASS | FAIL | SKIP(raison) avec preuve.
3. Lancer `npm test` + smoke si dispo.
4. Proposer améliorations normes strictes (OWASP, WCAG 2.2 AA, UX 2G/3G, fintech) en P0–P2.
5. Rapport structuré pour Security / Scope / Notion.
6. Spawn agent = PR de spec + tâche Notion seulement (pas d’auto-création).

## Signal fort
- Slack/GitHub : FAIL ou P0 uniquement.
- Succès total = silence.
- Hors scope F1–F6 = signaler à Scope, ne pas « améliorer » en feature hors bêta.
