# Cahier des charges GWA — Amendements version 2.0

- **Version :** 2.0 (amendements, pas une réécriture intégrale)
- **Date :** 25 novembre 2026 (Africa/Abidjan)
- **Statut :** Proposé — publication dans le dépôt ; fusion après GO QA, puis go de Yao
- **Référence code :** `main` @ `a53e021` (dépôt `KOUAME-TECH/v0-gwa`)
- **Document amendé :** cahier des charges v1.0 du 28 juillet 2026, archivé dans Notion ([Cahier des charges & roadmap](https://app.notion.com/p/3b4a6d3a76b481f6ad3df914decd13fd)) et, dans l’historique git, `docs/cahier-des-charges-actuel-evolution-6-12-24.md` (supprimé le 6 août 2026 lors de la migration vers Notion)
- **Décisions :** Yao, 25 novembre 2026 à 09:06 (Africa/Abidjan), transmises mot pour mot par le Coordinateur

Citations retenues :

> « Cahier des charges : Mettre à jour la documentation (Feexpay → GeniusPay, Socket.io → Supabase Realtime). Version 2.0. »

> « Amender le cahier des charges (§8.2) : SCG en TypeScript (FastAPI prévu M+6), app PWA (Expo prévu M+9). »

> « Wallet : Masquer immédiatement les pages /wallet et /payout via un Feature Flag. Le wallet reste invisible jusqu’à l’agrément BCEAO (M+12). »

Ce fichier et les ADR 012 à 015 font foi pour les points ci-dessous, jusqu’à une mise à jour correspondante de la page Notion. Ils ne remplacent pas le reste du CDC v1.0 (périmètre fonctionnel, règles métier hors paiement, roadmap 6/12/24 mois non citée ici).

**Note sur la numérotation « §8.2 ».** Le CDC v1.0 est organisé en sections lettrées A à J, pas en chapitres numérotés. Aucune section « 8.2 » n’existe dans ce document ni dans `docs/architecture.md` (historique). L’amendement demandé sous ce libellé est appliqué à la contrainte d’architecture (§E) et à la feuille de route stack / SCG / client (§G) : SCG et application cliente. Le moteur actuel porte déjà la mention interne `GWA-TECH-SCG-014` (port TypeScript d’un algorithme FastAPI).

---

## 1. Paiement — FeexPay remplacé par GeniusPay

### 1.1 Texte v1.0 (à remplacer)

Le CDC v1.0 présente FeexPay comme prestataire primaire (stack d’en-tête, §A escrow/paiement, §B.1 module F2, §C.4 escrow & wallet, §D HMAC webhook, schéma §E, §G.1 sortie sandbox FeexPay, §G.2 abstraction `provider: feexpay`, matrice §H). CinetPay y figure comme plan B. La page Notion porte déjà un bandeau historique indiquant que le remplacement a eu lieu le 21 octobre 2026.

### 1.2 Amendement

- **Prestataire d’encaissement (pay-in) :** GeniusPay, depuis le 21 octobre 2026 (commit `b8ec6d4`, « Replace FeexPay pay-in with GeniusPay »).
- **Escrow :** inchangé dans son principe — séquestre **applicatif GWA** (orchestration + compte marchand agrégateur). Le wording public reste « argent protégé jusqu’à confirmation ». On ne dit pas « séquestre GeniusPay ».
- **Parcours actuel :** création de commande côté serveur → `POST /api/orders/[id]/pay` (initiation GeniusPay, redirection vers le checkout hébergé) → webhook `POST /api/webhooks/geniuspay` et/ou `POST /api/orders/[id]/verify-payment` → `payment_status=paid`, `escrow_status=held` → confirmation de réception → libération applicative. Les versements vendeurs sont **manuels** (file ops / admin) tant que l’API de payout GeniusPay n’est pas branchée. Le health check expose `geniuspay.payout_ready: false` de façon **attendue** (valeur figée dans le code, pas un indicateur lu en base).
- **Devise :** XOF uniquement pour le pay-in, jusqu’à une intégration fournisseur validée.
- **Plan B CinetPay / dual provider :** plus une obligation à 6 mois liée à FeexPay. Toute bascule ou second prestataire fera l’objet d’une décision écrite ultérieure.
- **Secrets :** aucun identifiant, secret ou URL d’environnement n’est recopié ici. Les noms de variables et le comportement sont décrits dans le README du dépôt.

Détail et justification : [ADR-012](./adr/ADR-012-paiement-geniuspay.md).

---

## 2. Temps réel — Socket.io remplacé par Supabase Realtime

### 2.1 Texte v1.0

Le CDC v1.0 ne nomme pas Socket.io. `docs/architecture.md` (historique) indiquait déjà : le client Supabase navigateur sert à la lecture et au temps réel autorisés par la RLS ; les mutations sensibles passent par `app/api/*`.

### 2.2 Amendement

- **Bus temps réel de l’application :** Supabase Realtime (événements `postgres_changes` sur des canaux nommés), pas Socket.io, pas de serveur WebSocket dédié.
- **Constat code (`a53e021`) :** aucune dépendance `socket.io` / `socket.io-client` dans `package.json`. Les abonnements Realtime en production de code sont :
  - `app/messages/page.tsx` (canal boîte de réception) ;
  - `components/chat/chat-conversation.tsx` (canal de conversation) ;
  - `lib/nav/badges-store.ts` (badge de notifications).
- Le hook `hooks/use-realtime-location.ts` concerne la géolocalisation navigateur (nom trompeur) : ce n’est pas un canal Realtime.
- Les notifications push restent OneSignal ; elles ne remplacent pas le temps réel in-app.

Détail et justification : [ADR-013](./adr/ADR-013-temps-reel-supabase.md).

---

## 3. Amendement « §8.2 » — SCG en TypeScript, application PWA

### 3.1 Décision

| Élément | Aujourd’hui (contrainte CdC) | Échéance prévue |
| --- | --- | --- |
| Score de Confiance GWA (SCG) | Moteur v1 en **TypeScript**, dans le monolithe Next.js (`lib/scg/*`, routes `/api/scg/*` et `/api/admin/scg`) | **FastAPI prévu à M+6** (cible typique : SCG v2 / 5C, service dédié si le besoin est confirmé) |
| Application cliente | **PWA** (Next.js App Router, `public/manifest.json`, service worker, enregistrement dans `app/layout.tsx`) | **Expo prévu à M+9** (application native / store) ; aucune app Expo ni dépendance `expo` / `react-native` n’existe à ce jour |

Horizon zéro du CDC v1.0 = août 2026. Dans ce cadrage, M+6 ≈ février 2027 et M+9 ≈ mai 2027. Ces dates restent des **prévisions**, pas un engagement de livrer FastAPI ou Expo plus tôt que le besoin produit.

### 3.2 Constat code

- L’en-tête de `lib/scg/engine.ts` décrit déjà un « Port TypeScript de l’algorithme FastAPI (Ref: GWA-TECH-SCG-014) ». Il n’y a pas de service Python / FastAPI dans le dépôt (pas de `pyproject.toml`, `requirements.txt` ni `Dockerfile` applicatif).
- `lib/routes/inventory.ts` mentionne encore « v2 FastAPI post-bêta » pour `/api/admin/scg` : cela devient une **prévision M+6**, plus une description de l’existant.
- PWA livrée : manifeste, `components/pwa/service-worker-register.tsx`, `public/sw.js` (commentaire interne v22, OneSignal + shell). Le CDC v1.0 citait le cache `gwa-v21-offline` : le service worker a évolué depuis.

Détail et justification : [ADR-014](./adr/ADR-014-scg-typescript-pwa-expo.md).

---

## 4. Convention `/api` versus `/api/v1`

### 4.1 Constat

Sur `main` @ `a53e021` :

- **87** route handlers Next.js sous `app/api/**/route.ts`.
- **Aucun** chemin `app/api/v1/...`.
- Le CDC v1.0 §E impose déjà le schéma `PWA → /api/* (mutations sensibles) → Supabase / prestataires`.
- Les occurrences de `/api/v1` dans le code désignent des **API prestataires** (GeniusPay `…/api/v1/merchant`, OneSignal `https://onesignal.com/api/v1/notifications`), pas l’API de GWA.

### 4.2 Recommandation (retenue)

1. Conserver **`/api/<domaine>/...` sans numéro de version** pour le backend-for-frontend du monolithe (auth, commandes, paiement, SCG, admin, etc.). Ces routes sont l’interface de l’application, pas une API publique versionnée.
2. **Réserver `/api/v1/*`** à une future API publique ou partenaire (option « API lecture » du CDC v1.0 §G.2, vers M+12). Si elle est créée, elle naît versionnée dès le premier endpoint, avec authentification, contrats stables et documentation dédiée.
3. Ne pas dupliquer les routes existantes sous `/api/v1` « pour faire propre ». Ne pas faire cohabiter les deux préfixes pour le même usage.
4. Toute cassure volontaire d’un contrat public futur se fait par `/api/v2`, en laissant `/api/v1` le temps d’un décommissionnement annoncé.

Détail et justification : [ADR-015](./adr/ADR-015-convention-api.md).

---

## 5. Tarifs officiels (décision du 25 novembre 2026)

Yao a tranché le 25 novembre 2026 à 09:06 (Africa/Abidjan), décision relayée par le Coordinateur. **La grille du code fait référence.** Elle remplace la grille du CDC v1.0 (§C.1 : STARTER 7 500 F / 6,5 %, PRO 18 000 F / 5 %, commissions FREE 8 %, et « 0 frais GWA » côté acheteur retail).

### 5.1 Abonnements vendeurs

| Public | Nom public | Code stable | Prix mensuel | Commission GWA |
| --- | --- | --- | --- | --- |
| Producteurs | Graine | `FREE` | 0 F | 9 % |
| Producteurs | Pousse | `STARTER` | 3 000 F | 8 % |
| Producteurs | Récolte | `PRO` | 8 000 F | 7 % |
| Coopératives | Coopérative | `COOP_START` | 8 000 F | 7 % |
| Coopératives | Union | `COOP_PRO` | 20 000 F | 6 % |
| Coopératives | Fédération | `COOP_ENTERPRISE` | sur mesure | ≤ 5 % |

Dans le code et en base, Fédération est représentée par un plan actif à **0 F / 5 %** (taux plafond), le devis restant un processus ops. Les franchises, seuils de bascule et quotas de versements inclus (`payout_included`) ne font pas partie de cette décision tarifaire ; ils restent ceux de la migration `073_vision100_pricing.sql` et de `lib/pricing/published-grid.ts`.

### 5.2 Frais de service acheteur

**250 F par opération**, frais fixe, quelle que soit la commande. Source de vérité runtime : clé `platform_settings.buyer_service_fee_fixed` (posée par la migration 073). La fonction SQL `gwa_quote_pricing` l’applique au checkout et à la création de commande (`POST /api/orders`, `POST /api/orders/from-offer`, `GET /api/pricing/quote`). Au relâchement du séquestre, le grand livre prévoit l’écriture `ESCROW_GWA` → `REVENUE_GWA_BUYER_FEE`.

Le seed TypeScript (`lib/pricing/published-grid.ts`) garde encore `buyer_service_fee_fixed: 0` : ce n’est qu’une copie de secours d’affichage / tests, pas le chemin de paiement réel. Ce décalage de secours n’est plus un tarif « à arbitrer ».

---

## 6. Note — wallet masqué jusqu’à l’agrément BCEAO (M+12)


Décision de Yao du 25 novembre 2026 : masquer immédiatement les pages `/wallet` et `/payout` via un feature flag. Le wallet reste invisible jusqu’à l’agrément BCEAO (M+12, ≈ août 2027 dans le cadrage du CDC v1.0).

**État au SHA `a53e021` (avant la PR feature flag, hors de ce document) :**

- Les pages et routes `/wallet`, `/api/wallet/withdraw` et le back-office `/admin/finances/payouts` existent et restent atteignables.
- `/wallet` est dans la navigation (bottom nav, `lib/navigation/shell-routes.ts`) et dans les préfixes privés du middleware.
- Il n’existe pas de page applicative `/payout` côté utilisateur ; les versements passent par le wallet producteur et le back-office.
- Un hook `useFeatureFlag` et une table `feature_flags` existent déjà (ex. `video_calls`, RFQ). Ils ne masquent pas encore le wallet.

Cette note fige la **règle produit**. L’implémentation (flag `wallet` à `false` par défaut, masquage UI / routes) relève d’une PR dédiée, avec GO QA et, pour toute migration SQL de prod, un go écrit de Yao qui la nomme.

Le CDC v1.0 §G.3 (« agrément / cadre si wallet interne étendu ») et §C.4 (wallet visible pour le producteur) sont amendés en ce sens : pas de wallet utilisateur visible avant agrément.

---

## 7. Écarts constatés entre le CDC v1.0 et le code

Les points 1 à 6 sont le périmètre de ces amendements. Les écarts suivants restent vrais au SHA cité ; ils ne sont **pas** tranchés ici et devront être repris (mise à jour CDC, ou correctif code, selon décision).

| Sujet | CDC v1.0 | Code `main` @ `a53e021` |
| --- | --- | --- |
| Prestataire pay-in | FeexPay | GeniusPay depuis le 21/10/2026. Mentions FeexPay restantes : `lib/routes/inventory.ts` (ligne `/api/orders/[id]/pay` encore annotée « Live Feexpay », en doublon d’une ligne GeniusPay), agents Cursor (`.cursor/agents/gwa-*.md`), filtre Yelly (`lib/yelly/client.ts`), backlog `docs/chat-refonte-backlog.md` |
| Temps réel | Non mention de Socket.io ; architecture historique déjà orientée Supabase | Supabase Realtime uniquement ; pas de Socket.io |
| SCG / app | PWA déjà, SCG v1 + « v2 FastAPI » en post-bêta dans l’inventaire | TypeScript dans le monolithe ; PWA ; pas d’Expo, pas de FastAPI |
| Routes HTTP GWA | `/api/*` | 87 routes sous `/api/*`, zéro sous `/api/v1` |
| Wallet | Surface producteur visible (§B.2, §C.4) | Toujours visible ; le masquage par flag n’est pas encore dans `main` |
| Grille d’abonnement et frais acheteur | STARTER 7 500 / PRO 18 000 ; commissions 8 % / 6,5 % / 5 % ; « 0 frais GWA » acheteur | **Tranché le 25/11/2026** : voir §5. Cet écart n’est plus à arbitrer. |
| Versement vendeur | Payout FeexPay après confirmation | File manuelle ; `payout_ready` figé à `false` |
| Dépôt / prod documentés | README encore centré sur l’ancien miroir et l’URL Vercel historique | Dépôt canonique `KOUAME-TECH/v0-gwa` ; domaine produit `mygwa.org` |
| Phrase README | « Pas de dossier `docs/` » | Le dossier `docs/` existe déjà (`docs/chat-refonte-backlog.md`) ; le présent fichier s’y ajoute |
| Volume de tests | « Vitest (~177) » | La suite a grandi depuis (plusieurs centaines de tests) |
| OTP / Sender ID | « Sender ID à confirmer ops » | Depuis la PR #61, le sender personnalisé est optionnel ; le sender par défaut Africa’s Talking est le choix retenu |

Aucun secret, e-mail ou numéro n’est reproduit dans ce document.

---

## 8. ADR publiés avec ces amendements

Le dépôt n’avait pas de dossier ADR. Les ADR 001 à 011 existent hors dépôt (espace de travail agents et base Notion « Décisions »). La numérotation reprend à la suite :

| ADR | Sujet | Fichier |
| --- | --- | --- |
| ADR-012 | Prestataire de paiement GeniusPay | [docs/adr/ADR-012-paiement-geniuspay.md](./adr/ADR-012-paiement-geniuspay.md) |
| ADR-013 | Temps réel Supabase Realtime | [docs/adr/ADR-013-temps-reel-supabase.md](./adr/ADR-013-temps-reel-supabase.md) |
| ADR-014 | SCG TypeScript (FastAPI à M+6), PWA (Expo à M+9) | [docs/adr/ADR-014-scg-typescript-pwa-expo.md](./adr/ADR-014-scg-typescript-pwa-expo.md) |
| ADR-015 | Convention `/api` vs `/api/v1` | [docs/adr/ADR-015-convention-api.md](./adr/ADR-015-convention-api.md) |

---

## 9. Documents liés

| Document | Rôle |
| --- | --- |
| [Cahier des charges & roadmap](https://app.notion.com/p/3b4a6d3a76b481f6ad3df914decd13fd) (Notion, archive) | CDC v1.0 |
| `docs/architecture.md` (historique git, 6 août 2026) | Front / back ; déjà « Realtime via client Supabase » |
| README.md | Stack actuelle (GeniusPay, Supabase Realtime, PWA) |
| ADR-002, ADR-006, ADR-009 (hors dépôt / Notion) | Micro-paiement, webhook, sens du grand livre — non recopiés ici |
