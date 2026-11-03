# Redis prod status — rate-limit IA (Yelly)

**Date** : 2026-11-02 (infra agent — env + deploy production)  
**Branche** : `gwa/excellence-parcours-1e99` @ `2f9d54b276f0`  
**Prod** : https://mygwa.org · projet Vercel `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa`  
**Deploy** : `dpl_BmKBqbDJr2Sv9XJoHt3vrLNaaxK2` · target **production** · READY · alias `mygwa.org`

---

## Résumé

| Étape | Statut |
| --- | --- |
| Redis Upstash `gwa-prod` | **OUI** — PING PONG · id `4ee7d138-06ab-4bf5-8e57-d68ccea77279` · `eu-west-1` · endpoint `innocent-macaw-245903.upstash.io` |
| Env `KV_REST_*` + aliases UPSTASH sur Vercel | **OUI** — production + preview (upsert MCP) |
| Code fail-closed 10/min | **OUI sur prod** — SHA `2f9d54b` (branche excellence) |
| Health prod | **`rate_limit_redis: true`** |
| Burst prod | **PASS** — dense ×80 → **43×200 + 37×429** · message `Yelly est saturée…` · Redis `rl:block:YELLY_CHAT:*` sur ≥6 IPs egress |

---

## Variables (noms + scopes — pas de valeurs)

| Variable | Targets | Type | Note |
| --- | --- | --- | --- |
| `KV_REST_API_URL` | production, preview | encrypted | gwa-prod REST URL |
| `KV_REST_API_TOKEN` | production, preview | sensitive | gwa-prod REST token |
| `UPSTASH_REDIS_REST_URL` | production, preview | encrypted | alias |
| `UPSTASH_REDIS_REST_TOKEN` | production, preview | sensitive | alias |

Anciennes vars integration-store `KV_REST_*` restent sur **development** seulement.  
Token REST (redacted) : `gQAAAAAA…djZA` · URL : `https://innocent-macaw-245903.upstash.io`

`hasUpstash()` exige URL **et** token.  
`YELLY_CHAT` / `AI_ADVICE` : `maxRequests:10`, `windowMs:60000`, `requireRedis:true`, `blockDurationMs:5min`.

---

## Preuves

1. Health : `curl -sS https://mygwa.org/api/health` → `resilience.rate_limit_redis=true`, `deploy.git_sha=2f9d54b276f0`
2. Burst dense (egress multi-IP agent) : `docs/excellence/evidence/rate-limit/prod-yelly-burst-dense.log` · **43×200 / 37×429** · 1ʳᵉ 429 @ req 10
3. Redis après burst : clés `rl:block:YELLY_CHAT:<ip>` (TTL ~5 min) + `rl:count:YELLY_CHAT:<ip>` sur plusieurs IPs AWS egress
4. Note : un burst **séquentiel** depuis cet agent peut afficher beaucoup de 200 si l’egress **rotate d’IP** (chaque IP a son propre compteur 10/min). Le critère ~10×200 puis 429 est **par IP client**.

---

## Verdict infra

**PASS** — Redis branché en prod, code fail-closed déployé, 429 observés + clés Redis.

**Ne pas merger** PR #27 sans revue produit (GeniusPay/FeexPay **FROZEN**). Deploy production de la branche draft était **demandé explicitement** pour lever le NO-GO rate-limit.

---

## Follow-up tip `39c6900` (SEO live) — 2026-11-02

| Item | Status |
| --- | --- |
| Tip branch | `gwa/excellence-parcours-1e99` @ `39c6900` (JSON-LD / robots / sitemap code) |
| Prod SHA | **encore `2f9d54b`** — deploy tip **BLOQUÉ** (MCP 403 · CLI no token · GH dispatch 403) |
| Health Redis | **`rate_limit_redis: true`** inchangé |
| `/robots.txt` · `/sitemap.xml` | encore **404** jusqu’au deploy tip |
| UNIQUE NEXT | SSO consent — voir `docs/excellence/evidence/iter11/deploy-status.md` |

---

## Fallback CLI (si MCP SSO expire)

```bash
# Après `npx vercel login` + scope team gwa
printf '%s' 'https://innocent-macaw-245903.upstash.io' | npx vercel env add KV_REST_API_URL production --sensitive=false --scope gwa --yes
printf '%s' 'https://innocent-macaw-245903.upstash.io' | npx vercel env add KV_REST_API_URL preview --sensitive=false --scope gwa --yes
# TOKEN: coller depuis Upstash console (ne pas committer)
npx vercel env add KV_REST_API_TOKEN production --sensitive --scope gwa
npx vercel env add KV_REST_API_TOKEN preview --sensitive --scope gwa
npx vercel env add UPSTASH_REDIS_REST_URL production --scope gwa
npx vercel env add UPSTASH_REDIS_REST_URL preview --scope gwa
npx vercel env add UPSTASH_REDIS_REST_TOKEN production --sensitive --scope gwa
npx vercel env add UPSTASH_REDIS_REST_TOKEN preview --sensitive --scope gwa
```
