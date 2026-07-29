# Bienvenue dans le repo GWA — guide d’orientation équipe

**Pour :** nouveaux devs, produit, ops, stagiaires  
**Temps de lecture :** ~10 min  
**Prod :** https://v0-gwa-mu.vercel.app  
**Repo :** monolithe Next.js (pas de microservices)

Si tu te sens perdu : **lis ce fichier en premier**, puis ouvre seulement les 5 liens « lecture obligatoire » en bas.

---

## 1. C’est quoi GWA en une phrase ?

Marketplace agricole (Côte d’Ivoire) : acheter / vendre avec **escrow applicatif**, **SCG** (score confiance), **coopératives**, **PWA offline**, assistant **Yelly**.

**Ce n’est pas :** une banque, un réseau social, une plateforme de formations / artisanat.

---

## 2. Carte du repo (où regarder)

```
v0-gwa/
├── app/                  ← ÉCRANS (pages) + API HTTP
│   ├── page.tsx          ← Feed accueil
│   ├── marketplace/      ← Boutique
│   ├── panier/           ← Checkout
│   ├── publier/          ← Créer une annonce
│   ├── abonnement/       ← Plans vendeur
│   ├── dashboard/        ← Espaces producteur / coop / acheteur
│   ├── admin/            ← Back-office
│   ├── wallet/           ← Portefeuille vendeur
│   ├── yelly (via /yelly)← Assistant IA
│   └── api/              ← BACKEND HTTP (mutations sensibles)
│
├── lib/                  ← LOGIQUE MÉTIER (sans JSX)
│   ├── pricing/          ← Commissions + entitlements abo
│   ├── feexpay/          ← Pay-in / payout
│   ├── orders/           ← Escrow flow
│   ├── cooperatives/     ← Rôles + qualification coop
│   ├── offline/          ← Outbox / caches
│   ├── yelly/            ← Client Gemini
│   ├── scg/              ← Score de confiance
│   └── supabase/         ← Clients DB
│
├── components/           ← UI réutilisable
├── hooks/                ← Hooks React client
├── public/               ← Logo, PWA, service workers
├── scripts/schema/       ← Migrations SQL (001 → 053…)
├── tests/                ← Vitest
└── docs/                 ← Décisions + ops + CdC
```

| Tu cherches… | Tu vas dans… |
|--------------|--------------|
| Un **écran** (bouton, page) | `app/<route>/page.tsx` |
| Une **API** (POST/GET) | `app/api/<domaine>/` |
| Une **règle métier** (prix, escrow, coop) | `lib/<domaine>/` |
| Une **migration DB** | `scripts/schema/0XX_*.sql` |
| Une **décision produit / BP** | `docs/` (voir §5) |
| Un **test** | `tests/*.test.ts` |
| La **liste des routes** | `lib/routes/inventory.ts` ou `/dev/routes` en local |

---

## 3. Frontend vs backend (règle d’or)

```
Navigateur (page.tsx)  →  fetch("/api/…")  →  lib/…  →  Supabase / FeexPay / SMS
```

1. **Pas de secret** dans les pages (clés API = Vercel / serveur seulement).  
2. **Prix, commission, paiement, OTP** = toujours calculés / validés côté `app/api` + `lib`.  
3. Le client Supabase browser = lecture / realtime autorisés RLS — pas pour contourner les règles.

Détail : [`docs/architecture.md`](./architecture.md)

---

## 4. Domaines métier — qui touche à quoi

| Domaine | Fichiers clés | Owner typique |
|---------|---------------|---------------|
| **Pricing / abo** | `lib/pricing/*`, `app/abonnement`, `app/api/subscriptions` | Produit + backend |
| **Paiement / escrow** | `lib/feexpay/*`, `app/api/orders/[id]/pay`, `…/confirm`, `webhooks/feexpay` | Backend + ops |
| **Catalogue** | `app/marketplace`, `app/api/products`, `lib/products` | Fullstack |
| **Coops** | `lib/cooperatives/*`, `app/dashboard/cooperative`, `app/api/cooperatives` | Produit + backend |
| **SCG** | `lib/scg/*`, `app/scg` | Data / produit |
| **Auth OTP** | `lib/auth/*`, `app/api/auth`, `docs/ops-auth.md` | Ops + backend |
| **Offline PWA** | `lib/offline/*`, `public/*Worker*.js` | Frontend |
| **Yelly** | `lib/yelly/*`, `docs/yelly-gemini.md` | AI + backend |
| **Admin** | `app/admin/*`, `app/api/admin/*` | Ops |

---

## 5. Documentation — que lire (et dans quel ordre)

### Lecture obligatoire (J1)

| # | Doc | Pourquoi |
|---|-----|----------|
| 1 | **Ce fichier** | Orientation |
| 2 | [`cahier-des-charges-actuel-evolution-6-12-24.md`](./cahier-des-charges-actuel-evolution-6-12-24.md) | Ce qu’on construit + roadmap |
| 3 | [`scope-beta.md`](./scope-beta.md) | Ce qu’on **ne** construit **pas** |
| 4 | [`decision-strategique-pricing-gwa-2026-07-28.md`](./decision-strategique-pricing-gwa-2026-07-28.md) | Grille prix / commissions |
| 5 | [`architecture.md`](./architecture.md) | Front / back |

### Selon ton rôle

| Rôle | Lire ensuite |
|------|----------------|
| **Backend / paiements** | `abonnements-services-alignes-2026-07-28.md`, `avis-cinetpay-vs-feexpay-2026-07-28.md`, `ops-go-live.md` |
| **Produit / BP** | `politique-cooperatives-types-compte.md`, `positionnement-partenaires-bancaires.md`, `aide-decision-gwa-2026-07-27.md` |
| **Ops / support** | `ops-auth.md`, `ops-sms-sender-id.md`, `ops-support-backoffice.md`, `vercel-gemini-env.md` |
| **Frontend / UX** | `brand.md`, `onesignal-service-workers.md` |

### Docs à ne PAS prendre pour vérité absolue

Certaines analyses datées (audit du matin, anciens prix 6k/15k) sont **supersédées**.  
**Priorité :** fichiers « DÉCISION DG », CdC actuel, et le **code** (`lib/pricing/entitlements.ts`).

Index complet : [`docs/README.md`](./README.md)

---

## 6. Décisions figées (ne pas réouvrir sans DG)

| Décision | Résumé |
|----------|--------|
| Acheteur retail | Gratuit (0 abo, 0 frais GWA) |
| Commission | Sur le **vendeur** : 8 % / 6,5 % / 5 % |
| Abo | Free / 7 500 / 18 000 / Enterprise devis |
| Escrow | Applicatif GWA + FeexPay (pas séquestre FeexPay natif) |
| Type de compte | **Verrouillé** (pas de self-service) |
| Coops | 15 membres / 14 j · docs / 6 mois · multi-gestion |
| Banques | **Partenaires**, jamais concurrents |
| Scope | Agri only — pas formations / social / artisanat |

Toute promesse sur `/abonnement` doit exister dans `lib/pricing/entitlements.ts`.

---

## 7. Démarrer en local

```bash
git clone <repo>
cd v0-gwa
npm install --legacy-peer-deps
# Copier les vars (demander à un lead) → .env.local
npm run dev          # http://localhost:3000
npm test             # Vitest — doit rester vert
```

| Besoin | Commande / URL |
|--------|----------------|
| Cartographie routes | `/dev/routes` ou `lib/routes/inventory.ts` |
| Health prod | https://v0-gwa-mu.vercel.app/api/health |
| Déployer | Push `main` → Vercel |

**Migrations SQL :** toujours un **nouveau** fichier `scripts/schema/0XX_….sql` — ne jamais réécrire l’historique.

---

## 8. Flux critiques à connaître

### Achat (escrow)

```
Panier → POST /api/orders
      → POST /api/orders/[id]/pay     (FeexPay pay-in)
      → webhook FeexPay               (paid + held)
      → POST /api/orders/[id]/confirm (payout vendeur + release)
```

### Abonnement vendeur

```
/abonnement → POST /api/subscriptions/request
           → WhatsApp / paiement
           → admin POST /api/subscriptions/activate
           → profiles.subscription_tier
           → entitlements (annonces, boost, stats…)
```

### Publier une annonce

```
/publier → POST /api/products
         → gate Free max 5 actives (entitlements)
```

---

## 9. Comment contribuer sans casser

1. Branche `cursor/…-f056` ou branche feature d’équipe (pas de force-push sur `main` sans accord).  
2. Changer **un** domaine à la fois (ex. pricing seul, pas pricing + auth + SW).  
3. Si tu touches un bénéfice abo → mets à jour `entitlements.ts` **et** les tests.  
4. Si tu touches la DB → nouvelle migration numérotée.  
5. Lance `npm test` avant de dire « c’est bon ».  
6. N’ajoute pas de module hors scope (`docs/scope-beta.md`) — le scope guardian refuse.

---

## 10. Glossaire express

| Terme | Signification |
|-------|----------------|
| **Escrow applicatif** | GWA décide quand payer le vendeur ; fonds via agrégateur |
| **SCG** | Score de Confiance GWA |
| **Yelly** | Chat IA (Gemini) |
| **Entitlement** | Droit lié au palier d’abonnement |
| **GMV** | Volume brut des ventes |
| **PWA** | App installable + offline partiel |
| **RLS** | Row Level Security Supabase |

---

## 11. Qui contacter (process)

| Sujet | Canal |
|-------|--------|
| Accès Vercel / Supabase / clés | Lead tech / ops |
| Décision produit / prix / scope | DG / produit (docs décision) |
| Bug prod paiement / OTP | Ops + `docs/ops-go-live.md` |
| « Où est le fichier X ? » | Ce guide §2 + inventaire routes |

---

## 12. Checklist « je suis opérationnel »

- [ ] J’ai tourné `npm run dev` et ouvert le feed  
- [ ] J’ai lu le CdC + scope + pricing  
- [ ] Je sais où est `lib/pricing/entitlements.ts`  
- [ ] Je sais où sont pay / confirm / webhook FeexPay  
- [ ] Je sais qu’on ne change pas le type de compte en self-service  
- [ ] `npm test` est vert chez moi  

**Bienvenue dans l’équipe. En cas de doute : CdC + entitlements + ce guide > anciens audits.**
