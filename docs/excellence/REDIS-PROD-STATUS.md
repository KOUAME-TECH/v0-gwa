# Redis prod status — rate-limit IA (Yelly)

**Date** : 2026-11-02 (audit final — preuves exécutées)  
**Branche** : `gwa/excellence-parcours-1e99`  
**Prod** : https://mygwa.org · projet Vercel `v0-gwa` · team `gwa`

---

## Résumé

| Étape | Statut |
| --- | --- |
| Redis Upstash `gwa-prod` | **OUI** — PING PONG · id `4ee7d138-06ab-4bf5-8e57-d68ccea77279` · `eu-west-1` · endpoint `innocent-macaw-245903.upstash.io` |
| Env `KV_REST_*` sur Vercel | **NON** — write MCP bloqué (SSO team) |
| Code fail-closed 10/min | **Sur cette branche** — **pas** sur prod `c51133f` |
| Burst local (branche + Redis) | **PASS** — 10×200 puis 40×429 |
| Burst prod | **FAIL** — 50×200 |

---

## Preuves exécutées (cette session)

1. **Unit fail-closed** sans Redis : `tests/security-rate-limit-redis.test.ts` → PASS  
2. **Integration Redis** (algo YELLY) : first deny @11 / 10 allowed · `evidence/rate-limit/rateLimit-integration.json`  
3. **HTTP local** `POST /api/yelly/chat` ×50 avec `KV_REST_*` :  
   - health : `"rate_limit_redis": true`  
   - **10×200 + 40×429** · message `Yelly est saturée…`  
   - log : `docs/excellence/evidence/rate-limit/local-yelly-burst.log`  
4. **HTTP prod** ×50 : **50×200** · `docs/excellence/evidence/rate-limit/prod-yelly-burst.log`  
5. Health prod : **pas** de champ `rate_limit_redis` · SHA `c51133f88033`

---

## Variables attendues

| Variable | Alias |
| --- | --- |
| `KV_REST_API_URL` | `UPSTASH_REDIS_REST_URL` |
| `KV_REST_API_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

`hasUpstash()` exige URL **et** token.  
`YELLY_CHAT` / `AI_ADVICE` : `maxRequests:10`, `windowMs:60000`, `requireRedis:true`.

**REST URL** : `https://innocent-macaw-245903.upstash.io`  
**Token** : Upstash console / MCP `redis_get_database(include_credentials=true)` — **ne pas committer**.

---

## Action humaine UNIQUE

1. Approuver SSO (≈10 min, one-shot) :  
   **https://vercel.com/sso/session-requests/26kpwAu4qRLSUpMkKqlNo-fN_k6EfpA4**  
   (team `team_KUeqdoY34PvZoLu9pZYo284N`)
2. Vercel → `v0-gwa` → Environment Variables → Production **et** Preview :  
   - `KV_REST_API_URL` = `https://innocent-macaw-245903.upstash.io`  
   - `KV_REST_API_TOKEN` = *(REST token)* · Sensitive  
3. **Ne pas merger** PR #27 tant que NO-GO. Déployer **preview** de `gwa/excellence-parcours-1e99` (plan org peut bloquer : `upgradeToPro=…`).  
4. Redeploy après set env.  
5. **Validation** :  
   ```bash
   curl -sS https://<preview-or-prod>/api/health | jq .resilience.rate_limit_redis
   # attendu: true
   BASE=https://<preview-or-prod>
   for i in $(seq 1 25); do
     code=$(curl -sS -m 20 -o /tmp/y.json -w "%{http_code}" -X POST "$BASE/api/yelly/chat" \
       -H 'Content-Type: application/json' -H "Origin: $BASE" \
       -d "{\"message\":\"burst $i\"}")
     echo "$i $code"
   done
   # Succès: ~10 réponses métier puis HTTP 429
   ```

---

## Risques

- Poser Redis seul sur prod `main` **sans** le code PR #27 : le critère 429@10/min exige `requireRedis` + plafond 10.  
- GeniusPay/FeexPay : **FROZEN**.  
- Ne pas committer de tokens.
