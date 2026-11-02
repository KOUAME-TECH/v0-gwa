# Checklist humaine — gates non automatisables (Excellence)

**Date** : 2026-11-02  
**Branche** : `gwa/excellence-parcours-1e99`  
**Prod** : https://mygwa.org · **Ne pas merger** PR #27 (GeniusPay/FeexPay FROZEN)

---

## 1. Deploy tip → production (BLOQUANT SEO live)

| Étape | Action |
| --- | --- |
| A | Ouvrir le lien SSO Vercel (consent ~10 min) documenté dans `docs/excellence/evidence/iter14/deploy-status.md` |
| B | Ou Dashboard Vercel → projet `v0-gwa` → Deployments → Redeploy branche `gwa/excellence-parcours-1e99` → **Production** |
| C | Ou ajouter secret env agent `VERCEL_TOKEN` (scope team `gwa`, deploy) puis `npx vercel deploy --prod --scope gwa --yes` |
| D | Preuve : `curl -I https://mygwa.org/robots.txt` → **200** · idem `/sitemap.xml` · health `rate_limit_redis:true` |

## 2. HaveIBeenPwned (Supabase Auth)

Advisor security WARN unique : `auth_leaked_password_protection`.

1. Supabase Dashboard → projet **GWA-DATABASE** (`frorfexbcyfbydkiwxqv`)
2. Authentication → Providers / Password security
3. Activer **Leaked password protection** (HaveIBeenPwned)
4. Re-vérifier : MCP `get_advisors` type=security → WARN disparu

Bannière login/signup code : campagne active jusqu’au **2026-11-16** (`lib/auth/hibp-banner.ts`).

## 3. PITR / restore drill

MCP Supabase **n’expose pas** l’état PITR on/off.

1. Dashboard → Project Settings → Database → Backups
2. Confirmer **Point-in-time recovery** ON (plan Pro+)
3. Noter RPO / rétention
4. (Optionnel) Drill restore sur branche preview — documenter dans `docs/excellence/continuity.md`

## 4. Redis Upstash backups

`gwa-prod` plan **free** → `redis_list_backups` = vide.

1. Upstash console → `gwa-prod` → Backups / upgrade plan si RPO Redis requis
2. Garder `KV_REST_*` + aliases UPSTASH sur Vercel (ne pas casser `rate_limit_redis`)

## 5. E2E auth (audio / négociation)

Playwright non-auth couvre gates publiques. Pour ≥95 audio/nego :

1. Compte test **non-junk** (pas `test@`/`demo@`) en CI secrets
2. Parcours B + C de `manual-test-plan.md` (vocal → offre → PO)
3. Déposer captures sous `docs/excellence/evidence/e2e-auth/`

## 6. GeniusPay / FeexPay

**FROZEN** — ne pas configurer / activer dans cette campagne excellence.
