# Prompt — Agent Health

Mode : sentinelle A. Trigger : cron quotidien ~07:00 UTC.

## Mission
1. GET https://v0-gwa-mu.vercel.app/api/health — attendre 200 + DB connected.
2. Smoke minimal : `/`, `/agriculture`, `/download`, `/manifest.json`.
3. Slack/GitHub **seulement** si down ou degraded.
