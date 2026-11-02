# Redis prod status — rate-limit IA (Yelly)

**Date** : 2026-11-02  
**Agent** : follow-up after audit 91/100 NO-GO  
**Branche docs** : `gwa/excellence-parcours-1e99`  
**Prod** : https://mygwa.org · projet Vercel `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa`

---

## Résumé

| Étape | Statut |
| --- | --- |
| Redis Upstash provisionné | **OUI** (free) |
| Env `KV_REST_*` sur Vercel | **NON** — write MCP bloqué (SSO team) |
| Redeploy prod | **NON** |
| Burst Yelly → 429 @ 10/min | **NON** (prod encore ouvert) |
| Code fail-closed 10/min | Sur PR #27 seulement — **pas sur `main`/prod** (`git_sha` prod = `c51133f`) |

---

## 1. Comment l’app attend Redis

Fichier : `lib/security/upstash.ts`

| Variable | Alias accepté |
| --- | --- |
| `KV_REST_API_URL` | `UPSTASH_REDIS_REST_URL` |
| `KV_REST_API_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

`hasUpstash()` = URL **et** token présents.  
`RATE_LIMITS.YELLY_CHAT` / `AI_ADVICE` (branche PR #27) : **10 req/min**, `requireRedis: true` (fail-closed → 429 sans Redis).  
Route : `POST /api/yelly/chat` appelle `checkRateLimit("YELLY_CHAT")` **avant** auth/guest.  
Health (PR #27) : `rate_limit_redis: hasUpstash()` — **absent** sur health prod actuelle.

---

## 2. Base Upstash créée

| Champ | Valeur |
| --- | --- |
| `database_id` | `4ee7d138-06ab-4bf5-8e57-d68ccea77279` |
| `database_name` | `gwa-prod` |
| Plan | **free** (pas de fixed tier / pas de surprise billing) |
| `primary_region` | `eu-west-1` |
| Endpoint | `innocent-macaw-245903.upstash.io` |
| État | `active` — `PING` → `PONG` (vérifié MCP `redis_run_command`) |

**REST URL à poser** : `https://innocent-macaw-245903.upstash.io`  
**Token** : récupérer dans [Upstash Console](https://console.upstash.com/) → DB `gwa-prod` → REST API → `UPSTASH_REDIS_REST_TOKEN`  
(Token mid-redacted côté agent : `gQAAAAAAA8CP…504fjd` — **ne pas coller le secret dans le git**.)

---

## 3. Vercel env — bloqué côté agent

- `list_projects` voit `v0-gwa` / `gwa` / `gwa-2`.
- `get_project` / `filter_project_envs` / `create_project_env` / `list_deployments` → **404/403** sans consentement team SSO.
- Lien one-shot (régénérable) : agent → Vercel MCP `authorize_team_access` pour `team_KUeqdoY34PvZoLu9pZYo284N`.
- CLI `vercel` dans le sandbox : **logged out**.

### Checklist humaine (env + deploy)

1. **Upstash** : Console → `gwa-prod` → copier REST URL + token.
2. **Vercel** → projet **`v0-gwa`** (domaine `mygwa.org`) → Settings → Environment Variables :
   - `KV_REST_API_URL` = `https://innocent-macaw-245903.upstash.io` → **Production** (+ Preview recommandé)
   - `KV_REST_API_TOKEN` = *(token REST)* → **Production** (+ Preview) · type Sensitive
   - Optionnel (aliases) : `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — **pas requis** si `KV_REST_*` est posé.
3. **Ne pas merger** PR #27 tant que NO-GO. Pour appliquer le correctif rate-limit :
   - soit **redeploy preview** de `gwa/excellence-parcours-1e99` (si preview org OK),
   - soit déployer ce SHA en prod **manuellement** quand vous acceptez le déploiement hors merge,
   - soit attendre merge après GO.
4. Redeploy **après** set env (Vercel → Deployments → Redeploy, ou nouveau deploy du SHA voulu). Les env ne s’appliquent qu’au prochain build/runtime.
5. Vérifier health :  
   `curl -sS https://mygwa.org/api/health | jq '.rate_limit_redis, .deploy'`  
   Attendu après deploy PR #27 + KV : `rate_limit_redis: true`.

### Burst test (attendu : 429 après ~10/min)

```bash
# Même IP, Origin prod, 25 POST en < 60s
for i in $(seq 1 25); do
  code=$(curl -sS -m 20 -o /tmp/y.json -w "%{http_code}" -X POST \
    https://mygwa.org/api/yelly/chat \
    -H 'Content-Type: application/json' \
    -H 'Origin: https://mygwa.org' \
    -d '{"message":"burst-test '"$i"'"}')
  echo "$i $code $(head -c 80 /tmp/y.json)"
done
# Succès : ~10× 200 (ou réponses métier) puis HTTP 429
# "Yelly est saturée. Réessaie dans une minute."
```

**Baseline 2026-11-02 (avant Redis env)** : 3× POST unauth → **200** fallback ; health **sans** `rate_limit_redis` ; SHA prod `c51133f88033`.

---

## 4. Ce que l’agent a fait / pas fait

| Fait | Pas fait (bloqué) |
| --- | --- |
| Inspect env names + code IA | Set `KV_REST_*` sur Vercel |
| Créé Redis `gwa-prod` free eu-west-1 | Redeploy production |
| PING Redis OK | Burst 429 vérifié en prod |
| Demandé SSO Vercel team | Merge PR |

**Après SSO Vercel approuvé** : relancer l’agent pour `create_project_env` (upsert) + `create_deployment` du SHA PR #27 / instructions humaines, puis rejouer le burst.

---

## 5. Risques

- Poser Redis **seul** sur prod `main` **sans** le code 10/min + `requireRedis` de PR #27 : le rate-limit Upstash peut commencer à compter selon la config **main** (limites éventuellement plus hautes) — **le critère audit 429@10/min exige le code de la branche parcours**.
- GeniusPay / FeexPay : **FROZEN** (non touché).
- Ne pas committer tokens dans le repo.
