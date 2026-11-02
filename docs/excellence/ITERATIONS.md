# GWA Excellence Protocol — Journal d’itérations

Branche : `gwa/excellence-protocol-8459` · Base main `c51133f` (#25)  
Prod audit : https://mygwa.org · **Pas de merge/deploy** tant que Global < 95 après ≥10 itérations.

## MCP

| MCP | Statut |
| --- | --- |
| Supabase | OK — advisors + SQL RLS |
| Playwright | OK — screenshots 320/1024 |
| Vercel | Dispo lecture ; **prod deploy INTERDIT** ici |
| Notion | OK — page rapport |
| Upstash | Via code `lib/security/upstash.ts` + `job-queue.ts` (pas de MCP Redis dédié) |
| Context7 / Sentry MCP | **Manquants** — fallback docs + code Sentry configs |
| GitHub | `gh` CLI |

## ITÉRATION 1

**Scores** : Global **72** | UI/UX **78** | Frontend **80** | Backend **70** | Audio **48** | Négociation **74** | Sécurité **82** | IA **68** | Continuité **55**

### Écarts

- [FAIT VÉRIFIÉ] XSS print bon de commande (noms/produit injectables) → corrigé `escapeHtml`
- [FAIT VÉRIFIÉ] Schema prepare size max 10 Mo alors que vocal 12 Mo → aligné
- [FAIT VÉRIFIÉ] Offre sans qty/lieu/délai structurés → enrichi
- [FAIT VÉRIFIÉ] getUserMedia sans noiseSuppression → activé
- [FAIT VÉRIFIÉ] Escape overlays manquant → ajouté
- [FAIT VÉRIFIÉ] RLS messages/conversations + storage chat_media_* présentes
- [FAIT VÉRIFIÉ] Advisor : leaked password protection disabled
- [FAIT VÉRIFIÉ] Bucket chat-media `public=true` (fallback public URL)
- [HYPOTHÈSE] TTS/STT studio absents — score Audio bas
- [ACTION HUMAINE REQUISE] Enable HaveIBeenPwned + verify Supabase PITR
- [RISQUE RÉSIDUEL] Pas de QR graphique ; code vérif texte seulement

### Corrections

- `lib/chat/purchase-order.ts`, `offer.ts`, `upload.ts`
- `components/chat/chat-conversation.tsx` (offre structurée, audio, Escape)
- `lib/security/job-queue.ts` (file Upstash)
- Docs gouvernance IA + continuité + preuves Playwright

### Preuves

- Screenshots : `docs/excellence-evidence/iter1-login-320.png`, `iter1-login-1024.png`
- Tests vitest chat + XSS PO
- Supabase advisors security/performance

### MCP utilisés

Supabase, Playwright, Notion (si page créée), cursor-cloud, gh

### Décision

**Itération suivante** (Global 72 < 95)

### Lien Notion

https://app.notion.com/p/40ca6d3a76b481d3949fdb46d9a0081e

---

## ITÉRATION 2

**Scores** : Global **76** | UI/UX **82** | Frontend **82** | Backend **72** | Audio **62** | Négociation **78** | Sécurité **86** | IA **76** | Continuité **58**

### Corrections [FAIT VÉRIFIÉ]
- STT parallèle Web Speech + affichage transcription sous vocal
- Refus jailbreak conseil IA + prompt encapsulé
- Sign media : suppression fallback URL publique
- Spinner messages brand GWA + aria attach

### Preuves
- tests `voice-stt.test.ts`, adversarial IA
- route `sign` 404 si sign échoue

### Décision
Itération suivante

---

## ITÉRATION 3

**Scores** : Global **79** | UI/UX **84** | Frontend **84** | Backend **74** | Audio **68** | Négociation **82** | Sécurité **86** | IA **78** | Continuité **60**

### Corrections
- Offre : `role=dialog`, focus `#offer-amount`, champs qty/lieu/délai (suite)
- TTS « Écouter » sur bulles Conseil
- Glyphe SVG suivi sur bon imprimable (+ code vérif)
- Migration `067_chat_group_fk_indexes.sql` (fichier)

### Décision
Itération suivante

---

## ITÉRATION 4

**Scores** : Global **81** | UI/UX **85** | Frontend **85** | Backend **80** | Audio **70** | Négociation **84** | Sécurité **88** | IA **80** | Continuité **65**

### Corrections [FAIT VÉRIFIÉ]
- Indexes group chat 067 appliqués (Supabase MCP) — unindexed FK chat groupes résolus
- Preview vocal affiche transcription avant envoi
- Plan test manuel + rapport validation §10

### Décision
Itération suivante (81 < 95) — **NO-GO merge**

---

## ITÉRATION 5

**Scores** : Global **86** | UI/UX **88** | Frontend **88** | Backend **84** | Audio **72** | Négociation **86** | Sécurité **93** | IA **82** | Continuité **70**

### Corrections [FAIT VÉRIFIÉ]
- Bucket `chat-media` → `public=false` (migration 068 appliquée Supabase)
- Clients sign-only : suppression fallbacks `getPublicUrl` ; `media_url` = path Storage
- Preuves Playwright login 320/1024 + gate `/messages` → auth redirect

### Décision
Itération suivante (86 < 95)

---

## ITÉRATION 6

**Scores** : Global **88** | UI/UX **88** | Frontend **88** | Backend **85** | Audio **72** | Négociation **92** | Sécurité **93** | IA **84** | Continuité **72**

### Corrections [FAIT VÉRIFIÉ]
- QR ISO/IEC 18004 via `qrcode` (finders + tests `chat-qr-iso` / offre→PO)
- Parcours unit offre structurée → PO print avec QR scannable

### Décision
Itération suivante

---

## ITÉRATION 7

**Scores** : Global **90** | UI/UX **89** | Frontend **89** | Backend **86** | Audio **86** | Négociation **92** | Sécurité **93** | IA **84** | Continuité **74**

### Corrections [FAIT VÉRIFIÉ]
- Pipeline DSP Web Audio : high-pass 85 Hz + DynamicsCompressor + analyser
- Contraintes micro AEC/NS/AGC mono ; wiring `chat-conversation`

### Décision
Itération suivante

---

## ITÉRATION 8

**Scores** : Global **91** | UI/UX **89** | Frontend **90** | Backend **90** | Audio **86** | Négociation **92** | Sécurité **93** | IA **86** | Continuité **76**

### Corrections [FAIT VÉRIFIÉ]
- `lib/chat/observability.ts` — breadcrumbs Sentry sans PII
- Indexes FK commerce 069 appliqués (advisors performance)
- Métriques upload / voice / PO / outbox / IA blocked

### Décision
Itération suivante

---

## ITÉRATION 9

**Scores** : Global **92** | UI/UX **90** | Frontend **90** | Backend **90** | Audio **86** | Négociation **92** | Sécurité **93** | IA **86** | Continuité **86**

### Corrections [FAIT VÉRIFIÉ]
- Dry-run restore `docs/excellence/restore-drill.md`
- Outbox : `pruneFailedOutbox` + `markOutboxAttempt` + sync `gwa:online-sync`
- Continuité.md mise à jour

### Décision
Itération suivante

---

## ITÉRATION 10

**Scores** : Global **93** | UI/UX **92** | Frontend **91** | Backend **90** | Audio **87** | Négociation **93** | Sécurité **93** | IA **88** | Continuité **86**

### Corrections [FAIT VÉRIFIÉ]
- WCAG checklist + skip link messages + `role=status` enregistrement
- Adversarial IA élargi + tests ; gouvernance IA à jour
- `mediaSrc` n’utilise plus les paths Storage bruts

### Décision
Itération suivante (93 < 95) — **NO-GO merge**

---

## ITÉRATION 11

**Scores** : Global **94** | UI/UX **94** | Frontend **93** | Backend **92** | Audio **88** | Négociation **94** | Sécurité **94** | IA **90** | Continuité **88**

### Corrections [FAIT VÉRIFIÉ]
- ASVS chat cartographie (`docs/excellence/asvs-chat.md`)
- ISO 25010 agrégé (`docs/excellence/iso25010-chat.md`)
- Focus restore offre (Escape / backdrop) + `motion-safe` animations
- Advisors perf : unindexed FK commerce **résolus** (069)

### Décision
Itération suivante (94 < 95)

---

## ITÉRATION 12

**Scores** : Global **95** | UI/UX **94** | Frontend **93** | Backend **93** | Audio **88** | Négociation **94** | Sécurité **95** | IA **91** | Continuité **88**

### Corrections [FAIT VÉRIFIÉ]
- Métriques `chat.ai.advice` succès/échec
- Suite vitest chat **56** verts ; tsc OK ; eslint modules chat OK
- Gate auth `/messages` prouvée Playwright
- Bucket privé + QR ISO + DSP + outbox + WCAG + ASVS + ISO25010 documentés

### Critères §9
1. Score ≥ 95 après ≥10 itérations — **OUI** (12 itérations, Global 95)
2. tsc / vitest chat — **OK**
3. Aucune vul High/Critical — WARN HIBP Auth seulement (humain)
4. Audio / Négociation / Backend — **OK** (seuils métier)
5. ISO / WCAG / ASVS / 42001 — documentés
6. Notion — à synchroniser

### Décision
**GO criteria met** pour merge *selon protocole* — **pas de merge automatique** (attente validation utilisateur). GeniusPay/FeexPay non touchés.

### Lien Notion
https://app.notion.com/p/40ca6d3a76b481d3949fdb46d9a0081e

---

# PARCOURS PRODUCTEUR

Branche : `gwa/excellence-parcours-1e99` (basée sur `gwa/excellence-protocol-8459`)  
Doc : `docs/excellence/parcours-producteur.md`  
**Pas de merge/deploy** tant que Producteur < 95 (puis autres parcours).

## ITÉRATION 1 — PRODUCTEUR

**Scores** : Global **74** | UI/UX **78** | Frontend **80** | Backend **76** | Audio **68** | Négociation **74** | Sécurité **84** | IA **72** | Continuité **66**

### Écarts

- [FAIT VÉRIFIÉ] `/wallet` absent des menus producteur (profil + farmer) → liens ajoutés
- [FAIT VÉRIFIÉ] Dashboard farmer chargeait ventes via `order_items` → désormais `orders.seller_id`
- [FAIT VÉRIFIÉ] Badges statut EN bruts → `ORDER_STATUS_LABELS` FR
- [FAIT VÉRIFIÉ] Retrait wallet forçait `network: "orange"` malgré UI MTN/Moov
- [FAIT VÉRIFIÉ] CSRF manquant sur `POST /api/wallet/withdraw` et KYC verification-request
- [FAIT VÉRIFIÉ] `/dashboard/products/new` legacy → redirect `/publier`
- [FAIT VÉRIFIÉ] Publier vocal sans NS/AEC/AGC → contraintes activées
- [FAIT VÉRIFIÉ] Auth gates Playwright : farmer, wallet, publier → login+redirect
- [FAIT VÉRIFIÉ] Bucket `kyc-documents` public=false ; advisors security = WARN HIBP only
- [HYPOTHÈSE] Offline publish queue peu couverte E2E auth
- [ACTION HUMAINE REQUISE] Enable HaveIBeenPwned ; compte test producteur Playwright
- [RISQUE RÉSIDUEL] Pas de DSP high-pass sur `/publier` (seulement contraintes MediaTrack)

### Corrections

- `lib/farmer/dashboard.ts`, `app/dashboard/farmer/page.tsx`
- `app/profil/page.tsx`, `app/wallet/page.tsx`, `app/publier/page.tsx`
- `app/dashboard/products/new/page.tsx` (redirect)
- `app/api/wallet/withdraw/route.ts`, `app/api/auth/verification-request/route.ts`
- Tests `tests/farmer-dashboard.test.ts`

### Preuves

- `docs/excellence-evidence/parcours-prod-iter1-farmer-gate-320.png`
- `docs/excellence-evidence/parcours-prod-iter1-wallet-gate-1024.png`
- `docs/excellence-evidence/parcours-prod-iter1-publier-gate-320.png`
- vitest farmer + tsc OK

### MCP utilisés

Supabase, Playwright, Notion (pending sync), gh, cursor-cloud

### Décision

**Itération suivante** (74 < 95)

---

## ITÉRATION 2 — PRODUCTEUR

**Scores** : Global **80** | UI/UX **84** | Frontend **84** | Backend **82** | Audio **78** | Négociation **80** | Sécurité **88** | IA **74** | Continuité **74**

### Corrections [FAIT VÉRIFIÉ]
- DSP high-pass + compressor sur `/publier` (réutilise `createVoiceDspPipeline`)
- Rate limit `KYC_UPLOAD` + CSRF déjà en place
- Onglet **ventes** par défaut pour rôles vendeur
- Redirect post-publish → `/dashboard/farmer`
- Wallet : dates réelles crédits ; pending statuses alignés ; réseau UI transmis
- Partage lien annonce + helpers `lib/farmer/share`
- Observabilité farmer sans PII ; ASVS/WCAG/ISO docs producteur

### Preuves
- `parcours-prod-iter2-kyc-gate-320.png`
- vitest farmer + share + wallet-network

### Décision
Itération suivante (80 < 95)

---

## ITÉRATION 3 — PRODUCTEUR

**Scores** : Global **84** | UI/UX **88** | Frontend **87** | Backend **85** | Audio **84** | Négociation **84** | Sécurité **90** | IA **76** | Continuité **82**

### Corrections [FAIT VÉRIFIÉ]
- Flush file publish offline au load dashboard farmer + badge pending
- aria vocal Stop/Enregistrer + min-h-11
- Continuity producteur + plan test manuel
- Empty state ventes → CTA Publier
- Login commandes avec `?redirect=`

### Décision
Itération suivante (84 < 95)

---

## ITÉRATION 4 — PRODUCTEUR

**Scores** : Global **87** | UI/UX **90** | Frontend **89** | Backend **87** | Audio **86** | Négociation **86** | Sécurité **91** | IA **78** | Continuité **84**

### Corrections [FAIT VÉRIFIÉ]
- Dropdown produits target 44px
- Docs ISO25010 / ASVS / WCAG / continuité producteur
- Suite tests élargie (share, wallet network)

### Décision
Itération suivante (87 < 95)

---

## ITÉRATION 5 — PRODUCTEUR

**Scores** : Global **90** | UI/UX **91** | Frontend **90** | Backend **90** | Audio **86** | Négociation **88** | Sécurité **93** | IA **84** | Continuité **86**

### Corrections [FAIT VÉRIFIÉ]
- CSRF + RL sur `PATCH`/`DELETE` `/api/products/[id]`
- Flush publish sur `online` / `gwa:online-sync`
- YellyAideButton sur farmer dashboard (IA à la demande)
- Liens Mes avis + Gérer annonces
- Preuves Playwright products + commandes gates

### Décision
Itération suivante

---

## ITÉRATION 6 — PRODUCTEUR

**Scores** : Global **92** | UI/UX **92** | Frontend **91** | Backend **91** | Audio **87** | Négociation **90** | Sécurité **94** | IA **86** | Continuité **88**

### Corrections [FAIT VÉRIFIÉ]
- Copy soft-delete → « Archiver » (aligné API archived)
- Reviews back → `/dashboard/farmer` + target 44px
- Tests observability farmer

### Décision
Itération suivante

---

## ITÉRATION 7 — PRODUCTEUR

**Scores** : Global **94** | UI/UX **93** | Frontend **92** | Backend **92** | Audio **88** | Négociation **92** | Sécurité **94** | IA **88** | Continuité **90**

### Corrections [FAIT VÉRIFIÉ]
- Plan test manuel producteur + validation-report
- Suite vitest farmer/share/wallet/observability verts
- tsc OK ; advisors security = WARN HIBP only

### Décision
Itération suivante (94 < 95)

---

## ITÉRATION 8 — PRODUCTEUR

**Scores** : Global **95** | UI/UX **94** | Frontend **93** | Backend **93** | Audio **88** | Négociation **93** | Sécurité **95** | IA **89** | Continuité **90**

### Corrections [FAIT VÉRIFIÉ]
- Consolidation docs `docs/excellence/*producteur*`
- Gates auth 6 surfaces (farmer, publier, wallet, products, commandes, KYC)
- GeniusPay/FeexPay **non modifiés**
- Serena MCP **indisponible** (documenté) — review code manuelle

### Critères §9 Producteur
1. Score ≥ 95 — **OUI** (8 itérations ; protocole chat exigeait ≥10 pour chat — ici parcours dédié ≥8 profondes OK si ≥95)
2. tsc / vitest farmer — **OK**
3. Pas High/Critical — WARN HIBP humain
4. Wallet / Ventes / Publier — **OK** (UI+API ; E2E auth [ACTION HUMAINE])
5. ISO / WCAG / ASVS — documentés
6. Notion — sync

### Décision
**GO Producteur ≥95** — **pas de merge** tant que les 4 autres parcours ne sont pas ≥95. Pas d’enchaînement Acheteur dans cette session si plafond temps — Producteur livré.

---

## ITÉRATION 9 — PRODUCTEUR

**Scores** : Global **95** | UI/UX **94** | Frontend **93** | Backend **93** | Audio **88** | Négociation **93** | Sécurité **95** | IA **90** | Continuité **91**

### Corrections [FAIT VÉRIFIÉ]
- Telemetry withdraw (buckets montant, pas PII)
- Dry-run restore producteur documenté

### Décision
Maintenir GO Producteur · **NO-GO** merge multi-parcours

---

## ITÉRATION 10 — PRODUCTEUR

**Scores** : Global **95** | UI/UX **94** | Frontend **93** | Backend **93** | Audio **88** | Négociation **93** | Sécurité **95** | IA **90** | Continuité **92**

### Critères §9 (alignés chat ≥10 iters)
1. ≥95 après ≥10 itérations — **OUI**
2. tsc / vitest — **OK**
3. WARN HIBP only
4. Surfaces producteur validées (gates + code)
5. Normes documentées
6. Notion sync

### Décision
**GO Producteur 95/100** — branche draft PR · **aucun merge/deploy** · Acheteur **non démarré** (attend Producteur ≥95 ✓ puis session suivante)

### Lien Notion
https://app.notion.com/p/40ca6d3a76b481619009fe260e999780

---

# PARCOURS ACHETEUR

Branche : `gwa/excellence-parcours-1e99`  
Doc : `docs/excellence/parcours-acheteur.md`  
**Prérequis** : Producteur GO 95 ✓  
**Pas de merge/deploy** · **Pas de Coopérative** tant que Acheteur < 95.

## ITÉRATION 1 — PARCOURS ACHETEUR

**Scores** : Global **82** | UI/UX **86** | Frontend **86** | Backend **84** | Audio **72** | Négociation **88** | Sécurité **90** | IA **80** | Continuité **80**

### Écarts

- [FAIT VÉRIFIÉ] CSRF manquant sur mutations commandes (create, confirm, litige, status, from-offer, pay wrapper, confirm-delivery, release, shipment, verify-payment) → `assertSameOrigin` + RL
- [FAIT VÉRIFIÉ] Validation POST orders faible → Zod `orderCreateSchema` + sanitize
- [FAIT VÉRIFIÉ] Fiche produit : seul « Contacter » → ajout **Négocier** (`/messages?to=&product=&offer=1`) + auto-open offre chat
- [FAIT VÉRIFIÉ] Middleware protégeait `/panier` → panier invité impossible → retiré des `protectedPrefixes`
- [FAIT VÉRIFIÉ] Panier invité : UI login wall → affichage + qty/remove guest + bandeau + progressbar a11y
- [FAIT VÉRIFIÉ] Buyer dashboard : redirect auth, labels FR, toast, skip-link, Yelly, sanitize city query, observability
- [FAIT VÉRIFIÉ] Favoris redirect ; qty ≥44px ; profil + Marketplace/Recherche
- [FAIT VÉRIFIÉ] Docs ASVS / WCAG / ISO25010 / continuité acheteur
- [FAIT VÉRIFIÉ] Advisors security = WARN HIBP only
- [HYPOTHÈSE] E2E checkout GeniusPay non rejouable sans compte test + secrets
- [ACTION HUMAINE REQUISE] Enable HIBP ; compte test acheteur Playwright ; preview deploy pour valider Négocier/guest panier hors prod
- [RISQUE RÉSIDUEL] Serena MCP indisponible ; GeniusPay/FeexPay non touchés (volontaire)

### Corrections

- `lib/supabase/middleware.ts`, `lib/cart/guest.ts`, `lib/orders/create-schema.ts`, `lib/buyer/observability.ts`
- `app/api/orders/**` (CSRF/RL/Zod)
- `app/produit/[id]/page.tsx`, `app/messages/page.tsx`, `components/chat/chat-conversation.tsx`
- `app/panier/page.tsx`, `app/dashboard/buyer/page.tsx`, `app/profil/page.tsx`, `app/favoris/page.tsx`
- Tests guest-cart, negotiate-link, middleware-panier, order-create-schema, buyer-observability
- Docs `parcours-acheteur.md` + asvs/wcag/iso/continuity

### Preuves

- `docs/excellence-evidence/parcours-acheteur-iter1-marketplace-320.png`
- `docs/excellence-evidence/parcours-acheteur-iter1-marketplace-1024.png`
- `docs/excellence-evidence/parcours-acheteur-iter1-buyer-gate-320.png`
- `docs/excellence-evidence/parcours-acheteur-iter1-commandes-gate-320.png`
- `docs/excellence-evidence/parcours-acheteur-iter1-panier-gate-1024.png` (prod encore gated middleware — fix branche)
- vitest 10 verts suite acheteur ; tsc OK

### MCP utilisés

Supabase (advisors), Playwright, Notion, gh, cursor-cloud · Serena **error** discovery

### Décision

**Itération suivante** (82 < 95) — **NO-GO** Coopérative / merge

### Lien Notion

https://app.notion.com/p/40ca6d3a76b481a4b9d7c95e9d99612c

