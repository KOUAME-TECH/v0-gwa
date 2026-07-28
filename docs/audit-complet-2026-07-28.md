# AUDIT COMPLET GWA — 28 juillet 2026

**Produit :** GWA (Guinée We Are) — marketplace P2P + coopératives + escrow applicatif  
**Repo :** `MYSTERE-arch/v0-gwa` · branche `main`  
**Prod :** https://v0-gwa-mu.vercel.app  
**DB :** Supabase `GWA-DATABASE` (`frorfexbcyfbydkiwxqv`)  
**Déploiement audité :** READY · SHA `73da6ca1…` · `gwa-seller-abo-page` · 28/07/2026 ~05:24 UTC  

---

## 1. Verdict exécutif

| Dimension | Note /10 | Lecture |
|-----------|----------|---------|
| **App runtime (prod)** | **8.5** | Health OK, pages 200, SW offline v21, Gemini/Yelly LLM OK |
| **Alignement décisions DG / BP** | **7.0** | Pricing, lock type, coop policy, offline-first : en place ; escrow réel & payout : non |
| **Paiements & séquestre** | **3.5** | FeexPay keys présentes ; **pas d’URL de paiement** ; confirm = release DB sans payout |
| **Sécurité / ops secrets** | **5.0** | SMS Sender ID manquant ; clé Gemini a fuité (chat + doc) — rotation requise |
| **Traction / données** | **2.5** | ~12 profils, 3 produits actifs, 0 coop, 2 commandes |
| **Prêt go-live monétisé** | **4/10** | UX & offline prêts ; **cash-in/cash-out réel bloqué** |

**Synthèse une phrase :** GWA est une **PWA opérationnelle et cohérente produit**, pas encore une **plateforme de paiement escrow production-ready**.

---

## 2. Périmètre & méthode

### Inclus
- Health / pages / SW / déploiement Vercel
- Alignement code ↔ décisions figées (pricing, types compte, coop, paiement, offline)
- Chemins critiques : OTP SMS, commandes, pay, confirm, wallet, abo, Yelly, coop
- Snapshots Supabase (comptes, volumes)
- Docs déjà produites (état des lieux, propositions, CinetPay, SMS)

### Exclus / hors scope de ce passage
- Audit pénétration réseau / pentest formel
- Revue juridique KYC / régulation BCEAO
- Charge-test perf (Lighthouse batch)
- Contenu marketing / pitch deck

### Sources
- `GET /api/health` (prod)
- Pages HTML + SW `gwa-v21-offline`
- Vercel `list_deployments` / `get_runtime_logs`
- Supabase SQL (profiles, products, orders, coops, secrets, abo)
- Code : `lib/pricing/*`, `app/api/orders/**`, `lib/feexpay/*`, `lib/cooperatives/*`, `lib/offline/*`, `lib/yelly/*`
- Suite Vitest : **41 fichiers / 169 tests OK** (local)

---

## 3. Snapshot production (preuves)

### 3.1 Health (`/api/health`)

| Check | Valeur | Statut |
|-------|--------|--------|
| `status` | `healthy` | OK |
| `db_connected` | true | OK |
| `supabase_url` / anon / service | true | OK |
| `feexpay_api_key` / `shop_id` / `mode` | true / true / `sandbox` | Keys OK, **sandbox** |
| `gemini_api_key` | true | OK |
| `onesignal` | true | OK |
| `SMS_AT` + live username | true | OK |
| `SMS_AT_SENDER_ID` | **false** | **KO ops** |
| `sms_delivery_ready` | **false** | **KO ops** |
| `yelly_llm.configured` | true · provider `gemini` · model `gemini-3.1-flash-lite` | OK |

### 3.2 Surface web

| Route | HTTP |
|-------|------|
| `/` | 200 |
| `/marketplace` | 200 |
| `/publier` | 200 |
| `/abonnement` | 200 |
| `/yelly` | 200 |
| SW | `gwa-v21-offline` (+ shell `/publier`) |

### 3.3 Données (Supabase)

| Entité | Volume |
|--------|--------|
| Profils | ~12 |
| Produits `active` | 3 |
| Coopératives | 0 |
| Commandes | 2 |
| `subscription_requests` | 0 |
| `platform_secrets` (gemini) | 1 |

**Lecture :** socle technique vivant, **traction quasi nulle** — normal pré-lancement, mais le BP doit parler de *capacité* pas de *volume*.

---

## 4. Matrice décisions ↔ code

| Décision | Statut | Preuve / écart |
|----------|--------|----------------|
| Escrow = applicatif GWA via partenaire (pas FeexPay natif) | **Partiel** | Statuts `pending_payment` → `paid` → `delivered` → `completed` ; **fonds non gelés chez partenaire** |
| FeexPay primaire court terme, pas d’exclusivité 12 mois | **Doc OK / code partiel** | Keys sandbox ; `payment_url: null` (« finaliser SDK ») |
| CinetPay = plan B dual / séquestre BP | **Doc only** | `docs/avis-cinetpay-vs-feexpay-2026-07-28.md` ; **pas d’intégration code** |
| Buyer retail : 0 frais GWA | **OK** | `BUYER_SERVICE_FEE_RATE = 0` ; panier sans ligne buyer |
| Seller commission 8 / 6.5 / 5 % | **OK** | `lib/pricing/service-fee.ts` + orders |
| Abo seller Free / 7 500 / 18 000 / Enterprise | **OK UI + API** | `/abonnement` + `subscription_requests` ; **paiement = WhatsApp**, pas FeexPay abo |
| FREE max 5 annonces | **OK** | `POST /api/products` |
| Type de compte verrouillé | **OK** | UI + trigger `049` + PATCH filtré |
| Coop : pending → 15 membres / 14 j → docs / 6 mois ; multi-gestion | **Partiel** | Policy + rôles + RLS `050` ; **gates avancées = bannières**, peu de hard-block API |
| Offline-first | **Bon** | Outbox publish, cart snapshot, feed/market refresh, PDP cache, Yelly offline, SW v21 |
| Banques / IMF = partenaires | **Hors code** | Positionnement BP OK |
| SMS OTP opérationnel | **Fragile** | OTP souvent OK ; health dit Sender ID manquant |

---

## 5. Audits par domaine

### 5.1 Authentification & SMS

| Point | Constat |
|-------|---------|
| OTP | Route + Africa’s Talking branchés |
| Username live | Présent |
| Sender ID env | **Absent** (`AT_SENDER_ID` / alias) → `sms_delivery_ready: false` |
| Doc ops | `docs/ops-sms-sender-id.md` |

**Risque :** délivrabilité SMS non garantie / régression silencieuse ; health déjà rouge.

### 5.2 Paiements FeexPay

| Étape | Attendu BP | Réalité code |
|-------|------------|--------------|
| Créer commande | Oui | OK |
| Initier pay-in | URL FeexPay | **`payment_url: null`** même si keys OK |
| Webhook / confirmation | Marquer `paid` | Présent côté routes ; dépend du flux pay |
| Séquestre fonds | Hold partenaire ou ledger clair | **Statut applicatif seulement** |
| Confirm livraison | Payout seller − commission | **Update DB escrow_status** ; **pas d’appel payout FeexPay** |
| Wallet withdraw | Cash-out réel | **Simulation** (`lib/wallet/withdraw.ts`) |

**Fichiers critiques :**
- `app/api/orders/[id]/pay/route.ts` — stub explicite
- `app/api/orders/[id]/confirm/route.ts` — release DB only
- `lib/feexpay/client.ts` — client prêt, non branché bout-en-bout

### 5.3 Pricing & abonnements

| Élément | Statut |
|---------|--------|
| Commissions seller | Alignées DG |
| Buyer fee | 0 |
| Page `/abonnement` | Live |
| Demande abo | WhatsApp + table `subscription_requests` |
| Activation | Admin `POST /api/subscriptions/activate` |
| Paiement abo automatisé | **Absent** |

### 5.4 Coopératives

| Élément | Statut |
|---------|--------|
| Création `pending_validation` | OK |
| Multi-managers `admin|manager|member` | OK + RLS |
| Progression 15/14j + docs | Policy + UI |
| Restriction features avancées (mois 3) | **Soft** (bannières) |
| Coops en prod | **0** |

### 5.5 Offline-first

| Flux | Statut |
|------|--------|
| Publish texte (produit/post) hors ligne | Outbox + sync |
| Médias hors ligne | **Bloqué** (message explicite) |
| Panier | Snapshot local |
| Feed / marketplace | Refresh on online |
| PDP | Fallback cache catalogue |
| Yelly | Réponse locale offline |
| SW | `gwa-v21-offline` |

### 5.6 Yelly / Gemini

| Point | Statut |
|-------|--------|
| Provider | Gemini prioritaire |
| Modèle | `gemini-3.1-flash-lite` (stable) |
| Smoke prod | `source: llm` OK |
| Clé | Env et/ou `platform_secrets` |
| **Fuite clé** | Chat utilisateur + ancien `docs/vercel-gemini-env.md` → **rotation obligatoire** |

### 5.7 Sécurité (synthèse)

| ID | Sévérité | Finding |
|----|----------|---------|
| S1 | **P0** | Clé Gemini exposée (historique chat/doc) — rotate + purge |
| S2 | **P0** | Paiement stub → risque de « faux paid » / confusion ops si mal testé |
| S3 | **P1** | SMS Sender ID absent en health |
| S4 | **P1** | Withdraw simulé — ne pas présenter comme cash-out live |
| S5 | **P2** | Service role usage large (normal Next/Supabase) — surveiller RLS migrations |

---

## 6. Backlog priorisé (post-audit)

### P0 — Bloquants go-live monétisé / confiance

1. **Brancher FeexPay pay-in** : retourner une vraie `payment_url` (sandbox d’abord), E2E commande → payé.
2. **Brancher payout à la confirmation** : montant seller net commission ; journaliser échecs.
3. **Rotater clé Gemini** ; mettre à jour Vercel + `platform_secrets` ; ne plus committer de secret.
4. **Poser `AT_SENDER_ID` sur Vercel** + redeploy jusqu’à `sms_delivery_ready: true`.
5. **Clarifier publiquement** (FAQ / abo / wallet) : escrow applicatif + sandbox vs live.

### P1 — Semi-bloquants BP / ops

6. Décision CinetPay séquestre : POC dual ou report explicite.
7. Hard-gates API coop (features avancées) au-delà des bannières.
8. Paiement abo Starter/Pro (même FeexPay) ou process manuel formalisé + SLA activation.
9. Outbox médias (photo publish offline) ou message produit plus visible.
10. Inventaire routes / refresh liste produits après sync offline.

### P2 — Qualité & scale

11. Observabilité paiements (dashboard failed webhooks).
12. Tests E2E Playwright paiement sandbox.
13. Charge / perf marketplace.
14. KYC / conformité quand volume monte.
15. Seed démo (coops + commandes) pour démos BP.

---

## 7. Score « promesse BP » vs réalité

| Promesse BP typique | Preuve actuelle | Risque discours |
|---------------------|-----------------|-----------------|
| Marketplace Guinée | UI + 3 produits | Sous-estimer traction |
| Escrow / confiance | Statuts + copy | **Surpromettre le hold fonds** |
| Mobile Money | FeexPay keys | **Pas de checkout URL** |
| Coopératives | Policy + multi-gestion | 0 coop live |
| IA Yelly | Gemini OK | OK si clé rotée |
| Offline | SW + outbox | OK (médias limités) |
| Monétisation abo | Page 7 500 / 18 000 | Encaissement manuel |

**Recommandation discours BP :**  
« PWA offline-ready, pricing figé, escrow applicatif, intégration FeexPay en cours (sandbox) ; séquestre partenaire (CinetPay) en plan B. »

---

## 8. Checklist go / no-go

| Critère | Go ? |
|---------|------|
| Démo produit / UX / offline | **GO** |
| Démo Yelly | **GO** (après rotation clé) |
| Démo abo pricing | **GO** (parcours WhatsApp) |
| Paiement réel acheteur | **NO-GO** |
| Libération seller réelle | **NO-GO** |
| SMS health vert | **NO-GO** jusqu’à Sender ID |
| Lancement monétisé public | **NO-GO** |

---

## 9. Prochaines 10 actions (ordre recommandé)

1. Rotate Gemini + maj secrets  
2. `AT_SENDER_ID` Vercel + vérifier health  
3. Implémenter `payment_url` FeexPay sandbox  
4. E2E manuel 1 commande payée  
5. Payout à `confirm`  
6. E2E confirm → wallet seller  
7. Documenter mode sandbox vs live pour le pitch  
8. Soft-launch invite-only (pas promesse escrow bank-grade)  
9. POC CinetPay séquestre **ou** date de report écrite  
10. Seed 1 coop démo + 10 produits pour storytelling

---

## 10. Annexes

- État des lieux : `docs/etat-des-lieux-gwa-2026-07-28.md`
- Propositions : `docs/propositions-amelioration-2026-07-28.md`
- CinetPay vs FeexPay : `docs/avis-cinetpay-vs-feexpay-2026-07-28.md`
- SMS Sender ID : `docs/ops-sms-sender-id.md`
- Gemini env : `docs/vercel-gemini-env.md` (sans secret)
- Yelly : `docs/yelly-gemini.md`
- Coop / types : `docs/politique-cooperatives-types-compte.md`

---

*Audit généré le 28/07/2026 à partir de health prod, déploiements Vercel, SQL Supabase et revue code `main`.*
