# Continuité — PITR / Redis (itération 11+)

**Date** : 2026-11-02 · Branche `gwa/excellence-parcours-1e99`

## Supabase `GWA-DATABASE` (`frorfexbcyfbydkiwxqv`)

| Check | Résultat |
| --- | --- |
| MCP `get_project` | `ACTIVE_HEALTHY` · region `us-east-1` · Postgres 17 |
| Advisors security | WARN only: `auth_leaked_password_protection` (HIBP) |
| PITR enabled? | **NON VÉRIFIABLE via MCP** — pas d’API/SQL exposant PITR |
| Restore drill physique | **ACTION HUMAINE** (staging) |

## Upstash Redis `gwa-prod`

| Check | Résultat |
| --- | --- |
| State | `active` · type `free` · primary `eu-west-1` |
| PING | `PONG` |
| Keyspace | `db0:keys=1` |
| Backups list | **vide / null** (pas de daily backup sur free) |

## Prod health

- `https://mygwa.org/api/health` → `rate_limit_redis: true` · deploy SHA encore `2f9d54b` jusqu’au prochain deploy SEO
