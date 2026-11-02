# GWA Excellence — Parcours Producteur

**Branche** : `gwa/excellence-parcours-1e99` (fork de `gwa/excellence-protocol-8459` @ chat Global 95)  
**Prod audit** : https://mygwa.org  
**Règle** : aucun merge/deploy tant que les **5 parcours** (Producteur → Acheteur → Coopérative → Abonnement → Back-office) n’ont pas chacun ≥ 95.  
**Scope session** : Producteur uniquement jusqu’à ≥ 95.

## Surfaces

| Étape | Routes | Notes |
| --- | --- | --- |
| Dashboard | `/dashboard/farmer` | Stats, prochaines actions, ventes |
| Publier | `/publier` | Unifié (ex-`/dashboard/products/new` redirige) |
| Annonces | `/dashboard/products` | CRUD soft-archive |
| Ventes | `/dashboard/commandes` | Onglet Mes ventes |
| Wallet | `/wallet` | Retrait Mobile Money (ops manuel — pas GeniusPay API) |
| KYC | `/profil/verification` | Soft KYC pièce + selfie |

## Mapping scores (§8 adapté Producteur)

| Domaine | Signification Producteur |
| --- | --- |
| UI/UX | Clarté FR, CTAs, découverte wallet/KYC, WCAG |
| Frontend | Types, responsive, targets ≥44px, perf perçue |
| Backend | RLS, requêtes seller_id, Upstash RL, CSRF |
| Audio | Vocaux `/publier` (NS/AEC/AGC) |
| Négociation | Commerce : ventes, escrow copy, stock |
| Sécurité | Auth gates, CSRF, bucket KYC privé, ASVS L2 |
| IA | Yelly entitlements + coach SCG |
| Continuité | Offline publish queue, restore |

## MCP

| MCP | Statut |
| --- | --- |
| Supabase | OK |
| Playwright | OK |
| Notion | Sync agent |
| Vercel | Lecture seule — **pas de deploy** |
| Serena | Dispo |
| gh | OK |
| Context7 / Sentry / Redis MCP | **Manquants** — Upstash via `lib/security/*` |

## Journal

Voir `docs/excellence/ITERATIONS.md` section **PARCOURS PRODUCTEUR**.

## Scores Producteur (itération 8)

| Domaine | Score |
| --- | ---: |
| Global | **95** |
| UI/UX | 94 |
| Frontend | 93 |
| Backend | 93 |
| Audio | 88 |
| Négociation (commerce) | 93 |
| Sécurité | 95 |
| IA | 89 |
| Continuité | 90 |

**Décision** : GO Producteur seul — **NO-GO merge** global (autres parcours non démarrés). GeniusPay/FeexPay non touchés.

**Notion** : https://app.notion.com/p/40ca6d3a76b481619009fe260e999780
