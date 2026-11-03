<!-- CURSOR_AGENT_PR_BODY_BEGIN -->
## Audit externe — vérification 95→100 (NO-GO)

**Score audit** : **91/100** · **Verdict : NO-GO**  
Rapport : `docs/excellence/AUDIT_VERIFICATION_FINALE.md`

### Scorecard parcours

| Parcours | Revendiqué | Audit | Écarts clés |
|----------|----------:|------:|-------------|
| Producteur | 95 | 92 | E2E account, HIBP |
| Acheteur | 95 | 90 | Panier invité non prouvé prod, preview KO |
| Coopérative | 95 | 91 | Join E2E |
| Abonnement | 95 | 88 | Notion détail manquant |
| Back-office | 95 | 90 | Notion détail manquant |
| Chat (#26) | 97 | 92 | Rate-limit IA ouvert prod |

### Preuves AXE 1 (cette session)
- Screenshots **320/768/1024** : `docs/excellence/evidence/`
- RLS orders/messages/subscriptions OK ; **PII profiles anon corrigée** (migration)
- CSRF admin mutations **PASS** (15/15 + tests)
- Rate-limit IA : **FAIL prod** (burst 25/25) → code fail-closed 10/min + Redis requis

### Correctifs agent (cette PR)
- Logo Boutique + Abonnement, favicon metadata, watermark PO, dark tokens
- `requireRedis` YELLY/AI_ADVICE, health `rate_limit_redis`
- Migration profiles colonnes publiques sans email/phone

### Checklist humaine (bloquante 100/100)
1. **UNIQUE NEXT** : Provisionner Upstash Redis (`KV_REST_*`) + redeploy + burst Yelly → 429 après 10/min
2. Enable HaveIBeenPwned (Supabase Auth)
3. Débloquer preview Vercel PR #27 (plan org) + smoke panier invité
4. Comptes E2E Playwright (checkout / join coop)
5. Confirmer PITR Supabase
6. GO merge explicite — **pas de merge auto**

GeniusPay/FeexPay **non touchés**.

Notion hub : https://app.notion.com/p/40ca6d3a76b4819196eeed4411a27aa7
<!-- CURSOR_AGENT_PR_BODY_END -->
