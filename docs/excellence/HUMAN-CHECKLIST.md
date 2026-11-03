# Checklist humaine — gates non automatisables (Excellence)

**Date** : 2026-11-02  
**Branche** : `gwa/excellence-parcours-1e99`  
**Prod** : https://mygwa.org · **Ne pas merger** PR #27 (GeniusPay/FeexPay FROZEN)

---

## 1. Deploy tip → production (BLOQUANT SEO live)

| Étape | Action |
| --- | --- |
| A | **Préféré** : coller Vercel Access Token dans **Cloud Agent secret** ou **GitHub Actions secret** nommé `VERCEL_TOKEN` (team `gwa`, scope deploy) — **jamais** dans le chat. L’env projet Vercel seule **n’injecte pas** le token dans le shell agent. |
| B | Ou ouvrir le lien SSO Vercel (consent ~10 min) dans `docs/excellence/evidence/iter19/deploy-status.md` |
| C | Ou Dashboard Vercel → projet `v0-gwa` → Deployments → Redeploy branche `gwa/excellence-parcours-1e99` → **Production** |
| D | Ou après secret : `npx vercel deploy --prod --scope gwa --yes --token "$VERCEL_TOKEN"` |
| E | Preuve : `curl -I https://mygwa.org/robots.txt` → **200** · idem `/sitemap.xml` · health `rate_limit_redis:true` · SHA tip |

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

## 7. OneSignal — origines Web (preview + prod)

Sans cette étape, la console logue `[OneSignal] Origine … absente du dashboard` et le push web reste inactif (le code soft-fail sans casser Supabase auth).

1. OneSignal Dashboard → app **GWA** (`5f01e343-…`)
2. **Settings → Platforms → Web** (Typical Site)
3. Ajouter / confirmer les Site URL :
   - `https://mygwa.org`
   - `https://www.mygwa.org` (si utilisé)
   - `https://v0-gwa-gwa.vercel.app`
   - `https://v0-gwa-mu.vercel.app`
4. Workers : `OneSignalSDKWorker.js` / `OneSignalSDKUpdaterWorker.js` · path `/` · scope `/`
5. Recharger preview → plus de warn `domain_not_allowed` · `__GWA_ONESIGNAL_STATUS.ok === true`

Détail : `docs/excellence/PR-sw-csp-onesignal.md`

## Mission master-audio (2026-11-03)

- [ ] Dashboard Redeploy tip `gwa/excellence-parcours-1e99` → Production (robots/sitemap 200)
- [ ] Optional: inject Cloud Agent secret `VERCEL_TOKEN` or `Cursor_Agent` (do not paste in chat)
- [ ] Enable HIBP leaked-password protection (Supabase Auth)
- [x] Agent: logo master + audio WhatsApp shipped on branch (PR #27 no merge)
