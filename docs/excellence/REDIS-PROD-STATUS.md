# Redis prod status — rate-limit IA (Yelly)

**Date** : 2026-11-02 (follow-up SSO)  
**Agent** : follow-up after [Provision Upstash Redis for GWA](bc-eccb4416-c0a8-50f4-a371-a9e9827c7ea9)  
**Branche docs** : `gwa/excellence-parcours-1e99`  
**Prod** : https://mygwa.org · projet Vercel `v0-gwa` (`prj_6rxrwGIg7IhfuprNGnecPl2mncoK`) · team `gwa` (`team_KUeqdoY34PvZoLu9pZYo284N`)

---

## Résumé

| Étape | Statut |
| --- | --- |
| Redis Upstash provisionné | **OUI** (free) — credentials REST récupérés via MCP (non commités) |
| Env `KV_REST_*` sur Vercel | **NON** — write MCP encore bloqué (SSO / team consent) |
| Redeploy preview / prod | **NON** |
| Burst Yelly → 429 @ 10/min | **NON** |
| Code fail-closed 10/min | Sur PR #27 / branche parcours seulement — **pas sur `main`/prod** |

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

Aliases `UPSTASH_REDIS_REST_*` : **pas requis** si `KV_REST_*` est posé (code lit les deux).

---

## 2. Base Upstash créée

| Champ | Valeur |
| --- | --- |
| `database_id` | `4ee7d138-06ab-4bf5-8e57-d68ccea77279` |
| `database_name` | `gwa-prod` |
| Plan | **free** |
| `primary_region` | `eu-west-1` |
| Endpoint | `innocent-macaw-245903.upstash.io` |
| État | `active` |

**REST URL à poser** : `https://innocent-macaw-245903.upstash.io`  
**Token** : récupéré via Upstash MCP `redis_get_database(include_credentials=true)` côté agent — mid-redacted `gQAAAAAAA8CP…504fjd` — **ne pas coller le secret dans le git**.  
Sinon : [Upstash Console](https://console.upstash.com/) → DB `gwa-prod` → REST API.

---

## 3. Vercel env — encore bloqué (SSO)

- `list_projects` / `list_teams` voient `v0-gwa` + team `gwa`.
- `get_project` / `filter_project_envs` / `create_project_env` → **404 not_found** sans consentement team.
- **SSO / team consent (one-shot, ~10 min)** — ouvrir et approuver :

  **https://vercel.com/sso/session-requests/uCdxv1JkWWRIpoKd3JsJ3zO45MtcvDFk**

  (`authorize_team_sso` pour `team_KUeqdoY34PvZoLu9pZYo284N`, émis 2026-11-02 follow-up ; lien précédent `g8CORDKvIe8PdvtZlLxC2QPWxxy1JuwQ` expiré.)

- Après approbation : relancer l’agent pour `create_project_env` (upsert) + preview deploy branche `gwa/excellence-parcours-1e99` + burst Yelly.
- CLI `vercel` sandbox : **logged out** — pas de workaround token-in-git.

### Checklist humaine (si SSO non fait)

1. Ouvrir le lien SSO ci-dessus (ou régénérer via agent / Vercel MCP `authorize_team_sso`).
2. **Vercel** → projet **`v0-gwa`** → Settings → Environment Variables :
   - `KV_REST_API_URL` = `https://innocent-macaw-245903.upstash.io` → **Production** + **Preview**
   - `KV_REST_API_TOKEN` = *(token REST)* → **Production** + **Preview** · type Sensitive
   - Optionnel : `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
3. **Ne pas merger** PR #27 tant que NO-GO. Preview deploy de `gwa/excellence-parcours-1e99` pour le code 10/min + `requireRedis`.
4. Redeploy **après** set env.
5. Health attendu (preview/PR code + KV) : `rate_limit_redis: true`.

### Burst test (attendu : 429 après ~10/min)

```bash
# Remplacer BASE par l’URL preview (pas main/prod tant que code 10/min n’y est pas)
BASE=https://<preview>.vercel.app
for i in $(seq 1 25); do
  code=$(curl -sS -m 20 -o /tmp/y.json -w "%{http_code}" -X POST \
    "$BASE/api/yelly/chat" \
    -H 'Content-Type: application/json' \
    -H "Origin: $BASE" \
    -d '{"message":"burst-test '"$i"'"}')
  echo "$i $code $(head -c 80 /tmp/y.json)"
done
# Succès : ~10× réponses métier puis HTTP 429
```

**Baseline** : prod sans Redis env + sans code PR #27 — rate-limit 10/min fail-closed **non vérifiable**.

---

## 4. Ce que l’agent a fait / pas fait (ce follow-up)

| Fait | Pas fait (bloqué SSO) |
| --- | --- |
| Découvert outils Vercel MCP (`authorize_team_sso`, `create_project_env`, …) | Set `KV_REST_*` / aliases sur Vercel |
| Régénéré lien SSO team `gwa` | Preview deploy parcours |
| Récupéré REST URL+TOKEN Upstash `gwa-prod` (mémoire agent only) | Burst 429 |
| Confirmé `list_projects` OK / ops projet 404 | Merge PR |

**Après SSO approuvé** : `create_project_env` upsert prod+preview → `create_deployment` ref `gwa/excellence-parcours-1e99` (preview) → burst → maj ce doc.

---

## 5. Risques

- Poser Redis **seul** sur prod `main` **sans** le code 10/min + `requireRedis` de PR #27 : le critère audit 429@10/min exige le code de la branche parcours.
- GeniusPay / FeexPay : **FROZEN** (non touché).
- Ne pas committer tokens dans le repo.
