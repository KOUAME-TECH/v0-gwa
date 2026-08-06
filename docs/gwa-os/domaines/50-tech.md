# 🧱 Tech

**Domaine stable** — stack, architecture, décisions techniques, intégrations.

---

## État actuel

| Couche | Choix |
|--------|-------|
| Front | Next.js App Router · PWA · Vercel |
| DB / Auth | Supabase (Postgres + Auth OTP) |
| Paiement | FeexPay (pay-in / payout / webhook HMAC) |
| SMS | Africa’s Talking |
| Push | OneSignal |
| IA | Gemini (Yelly vendeur + Yelly Ops admin) |
| Cache / rate | Upstash Redis (si configuré) |
| Tests | Vitest (~196) |

## Règles établies

1. **FeexPay** = provider paiement ; escrow logique GWA (T-01).
2. **PWA avant mobile natif** ; natif après **1er sept 2026** (T-02).
3. **AT ≠ OneSignal** (T-03).
4. Admin mutations via **service role** ; client jamais pour colonnes privilégiées.
5. CSRF same-origin ; `x-gwa-internal-key` doit matcher un secret env.
6. `typescript.ignoreBuildErrors: true` encore actif — dette P2.

## Intégrations (health)

| Service | Rôle | Bloquant go-live ? |
|---------|------|--------------------|
| FeexPay | Argent | **Oui** si keys absentes |
| Africa’s Talking | OTP | **Oui** si Sender ID absent |
| OneSignal | Push | Non (dégradé) |
| Gemini | Yelly | Non (feature) |
| Supabase | Core | Oui |

## Questions ouvertes

- Migrer vers `supabase/migrations/` un jour (Deploy GitHub) ?
- Couper `ignoreBuildErrors` quand typage propre ?
- Capacitor vs RN pour post-sept ?

## Liens repo

- `docs/architecture.md`
- `docs/security.md`
- `docs/yelly-gemini.md`
- `docs/roadmap-mobile-post-1er-septembre-2026.md`
- `supabase/README.md`
