# Analyse comparative & suggestions — Réunion Fixpay / FeexPay (27 juil. 2026)

**Source :** notes Gemini réunion 27 juil. 2026 · 14:22 UTC  
**Participants notés :** Jessica EBIELE, Yann Mangoua, Fatime Cisse (Fixpay) · Yao Kouamé (GWA / KOUAME Corporation)  
**Croisement :** produit GWA (`Smart Escrow`), BP 23 juil., `lib/pricing/service-fee.ts`, `docs/ops-go-live.md`

---

## Verdict

La réunion est **utile et plutôt favorable** sur les tarifs (marge GWA ~5 % + forfait 3 % discuté), mais elle **change le modèle d’escrow** : Fixpay ne séquestre pas. Le « Smart Escrow » GWA devient un **escrow applicatif / trésorerie marchand** (GWA décide du payout), pas un séquestre hébergé chez l’agrégateur. À traiter comme **décision produit + juridique + BP**, pas seulement comme négociation prix.

---

## 1. Ce que disent les notes (faits)

| Sujet | Accord / clarification |
|-------|-------------------------|
| Modèle Fixpay | Pay-in + pay-out **directs**, **sans compte séquestre** chez Fixpay |
| Contrôle des fonds | Une fois encaissé, **GWA contrôle le reversement** (après validation livraison) |
| API | Pay-out possible via API Fixpay (confirmé en réunion) |
| Tarif global | Accord de principe : Fixpay prend ses frais ops ; **GWA conserve ~5 %** de marge |
| Proposition Kouamé | **3 % tout compris** (ex. 2 % acheteur + 1 % producteur) |
| Payout 1 % | À étudier **réseau par réseau** (Orange plus cher / exclu du 1 % facile) |
| Plafond virement | Demande GWA : frais virement **plafonnés à 50 000 FCFA** |
| Sandbox | Yann : rouvrir accès sandbox **avant 1er sept.** |
| Suite | Analyse commerciale consolidée → **avenant contrat** |

*Qualité des notes Gemini :* cohérentes sur le fond (pas de séquestre Fixpay, contrôle payout GWA, 5 % marge). À vérifier en interne : orthographe **Fixpay vs FeexPay**, montants exacts (2 % collect / 1 % payout), et si « 5 % » est **net GWA** ou **brut avant** frais Fixpay.

---

## 2. Analyse comparative

### 2.1 Escrow : promesse GWA vs réalité Fixpay

| Dimension | Narratif BP / produit GWA | Réalité Fixpay (réunion) | Écart |
|-----------|---------------------------|---------------------------|-------|
| Qui « bloque » l’argent | Smart Escrow = séquestre jusqu’à livraison | Fixpay **ne bloque pas** ; flux direct | **Majeur** |
| Où dort le cash | Sous-entendu « protégé / séquestré » | Sur le **compte marchand / flux GWA** (via Fixpay) | À clarifier juridiquement |
| Libération vendeur | Confirmation livraison → release | GWA appelle **pay-out API** quand il décide | Aligné **si** GWA orchestre bien |
| Litige / freeze | `escrow_status: frozen` en code | Pas de gel natif Fixpay → **règle métier GWA** + éventuel gel de payout | À spécifier |
| Risque réglementaire | Escrow « plateforme » | Détention / ordre de fonds = **responsabilité GWA** (+ cadre BCEAO) | **Critique** |

**Lecture :** le code GWA (`escrow_status: held/released/frozen`) reste valide comme **machine d’état métier**. Ce qui change : `held` ne signifie plus « chez Fixpay en séquestre », mais « **encaissé, pas encore payé au vendeur** ».

### 2.2 Tarifs : réunion vs BP vs code

| Source | Logique | Ordres de grandeur |
|--------|---------|---------------------|
| **Réunion 27/07** | Fixpay frais ops + **marge GWA ~5 %** ; proposition client **3 %** tout compris (2+1) | Empilement à modéliser (pas encore figé) |
| **BP 23/07** | Commission canal 0 / 4 / 5 / 6 / 8 % | P&L An.1 en **5 % plat** |
| **Code actuel** | Frais service selon **abonnement acheteur** | free **2,5 %** → enterprise **0,3 %** |

```
Hypothèse à valider (lecture « accord de principe ») :

  Prix payé par l’acheteur
    = montant vendeur
    + frais Fixpay (pay-in ~2 % + éventuel payout)
    + marge GWA (~5 % si on suit la réunion)
    ± répartition 2 % acheteur / 1 % producteur (proposition Kouamé)

Attention : 5 % GWA + 2–3 % Fixpay ≠ 3 % « tout compris ».
Les notes mélangent probablement :
  (A) marge commerciale GWA cible ≈ 5 %
  (B) forfait utilisateur proposé ≈ 3 %
→ Il faut une seule table « qui paie quoi » avant l’avenant.
```

### 2.3 Plafond virement 50 000 FCFA

| Pour GWA | Contre / vigilance Fixpay |
|----------|---------------------------|
| Attractif gros acheteurs / export | Fixpay vend aussi la techno + risque |
| Aligné usages MM (frais plafonnés) | Peut compresser la marge Fixpay sur gros tickets |
| Argument compétitivité marketplace B2B | À obtenir **écrit** (avenant), pas oral |

**Suggestion :** accepter un plafond **pilote** (ex. 3–6 mois / volume max) plutôt qu’illimité dès le jour 1.

### 2.4 Calendrier vs go-live 1er sept.

| Étape | Statut post-réunion | Risque Sept. |
|-------|---------------------|--------------|
| Sandbox API | Action Yann — **pas encore livré** | Élevé si retard |
| Pay-in SDK / `payment_url` | Toujours à finaliser côté GWA | Bloquant |
| Pay-out API | Confirmé possible — **à tester** | Moyen |
| Avenant tarifaire | Après validation tech/com | Moyen (peut ship en tarifs provisoires) |
| OTP SMS / ops | Hors réunion, toujours checklist | Bloquant parallèle |

---

## 3. Implications pour GWA (produit, legal, com)

### Produit / tech
1. Renommer mentalement : **Escrow métier GWA** + **paiement Fixpay** (pas « séquestre FeexPay »).
2. Implémenter explicitement : webhook pay-in → `paid` + `escrow_status=held` ; confirm livraison → **appel pay-out** → `released`.
3. Litige : bloquer payout côté GWA (`frozen`) + process support ; pas d’attente d’un freeze Fixpay.
4. Afficher à l’utilisateur : « Argent protégé **jusqu’à confirmation** » (déjà le ton Yelly) — **sans** laisser croire que Fixpay est le dépositaire séquestre.

### Juridique / conformité
1. Faire valider par conseil : **KOUAME Corporation** peut-elle détenir / ordonner des fonds clients sans agrément paiement ? (Fixpay est agréé BCEAO ; GWA orchestre.)
2. CGV / contrat vendeur : délais de release, cas litige, frais supportés par qui.
3. Wallet interne (cahier 12/24) : encore plus clairement **conditionné** — la réunion confirme qu’on n’a pas de séquestre agrégateur « gratuit ».

### Business plan / pitch
1. Remplacer toute formulation « séquestre chez l’agrégateur » par « **protection de paiement orchestrée par GWA** (encaissement via partenaire agréé, reversement après livraison) ».
2. Recaler la grille revenus : une table unique Fixpay + GWA (voir suggestions §4).
3. Risque SWOT : ajouter « dépendance modèle escrow applicatif / float trésorerie ».

---

## 4. Suggestions (priorisées)

### P0 — Cette semaine (avant avenant)

| # | Action | Owner suggéré |
|---|--------|----------------|
| 1 | **Table tarifaire unique** (1 page) : pay-in %, payout % par réseau, marge GWA, qui paie (acheteur/vendeur), plafond virement | Kouamé + Yann |
| 2 | Exiger **sandbox** écrite (date, credentials, docs API pay-in **et** pay-out) avant le 1er sept. | Relance Yann |
| 3 | Clarifier par écrit : « Fixpay ne fournit pas de séquestre ; GWA déclenche le payout » | Avenant / email conformité |
| 4 | Arbitrer le conflit **3 % tout compris vs 5 % marge GWA** — choisir un scénario chiffré | Kouamé |
| 5 | Alignement interne BP ↔ code ↔ réunion (une grille) | Produit / docs |

### P1 — Négociation avenant (positions recommandées)

| Demande | Position GWA suggérée |
|---------|------------------------|
| Marge plateforme | **Cible nette GWA ≥ 4–5 %** sur GMV mediocre ; sinon abo SaaS ne sauve pas An.1 |
| Forfait utilisateur | Si 3 % TTC affiché, alors **subvention** partielle GWA ou réduction Fixpay — ne pas promettre 3 % si coûts Fixpay ≈ 2–3 % |
| Payout 1 % | Accepter **grille par opérateur** (Orange exclu ou tarif dédié) plutôt qu’un 1 % universel |
| Plafond virement 50 k | **Oui en pilote** (cap volume / durée) ; clause de revue |
| Exclusivité | Éviter exclusivité longue tant que sandbox + payout non prouvés |

### P2 — Produit avant bêta publique

| # | Livrable |
|---|----------|
| 6 | Intéation SDK / `payment_url` réelle (fin du `null`) |
| 7 | Endpoint/job **payout vendeur** branché sur confirm livraison + admin override |
| 8 | UX timeline escrow mise à jour (textes « protégé / libéré ») |
| 9 | Runbook litige : freeze payout + SLA support |
| 10 | Test E2E sandbox : pay-in → held → confirm → payout → released |

### Formulation commerciale suggérée (après clarification)

> « Sur GWA, l’acheteur paie via un partenaire de paiement agréé. L’argent n’est reversé au producteur **qu’après confirmation de livraison**. GWA orchestre cette protection ; le partenaire assure l’infrastructure de paiement. »

Éviter : « compte séquestre FeexPay / Fixpay ».

---

## 5. Score de la réunion pour GWA

| Critère | /5 | Commentaire |
|---------|-----|-------------|
| Clarté modèle ops | 4 | Pas de séquestre Fixpay = clair (même si surprenant) |
| Intérêt tarifaire | 3,5 | 5 % marge ok ; 3 % tout compris **ambigu** |
| Faisabilité tech Sept. | 3 | Sandbox + payout à prouver |
| Alignement narratif escrow | 2 | Gros écart vs pitch « séquestre » classique |
| Prochaines étapes | 4 | Actions nommées (Yann) — à suivre en écrit |
| **Global** | **≈ 3,3 / 5** | Bon progrès commercial ; **refonte wording + architecture float** obligatoire |

---

## 6. Points à vérifier dans les notes Gemini (qualité)

| Possible erreur / flou | Pourquoi vérifier |
|------------------------|-------------------|
| Fixpay vs FeexPay | Même acteur ? Branding contrat |
| « 5 % partenaire » vs « 3 % tout compris » | Incompatible sans détail |
| « Fonds déposés sur la plateforme de Yao » | Compte bancaire KOUAME ? Compte marchand Fixpay ? |
| Orange exclu du 1 % payout | Demander grille écrite tous réseaux |
| « Accord de principe » | Pas encore avenant — ne pas communiquer en externe comme signé |

---

## Références internes

- Analyse BP : `docs/analyse-business-plan-2026-07-27.md`
- Go-live paiement : `docs/ops-go-live.md`
- Machine d’état escrow : `lib/orders/escrow-flow.ts`
- Pay init : `app/api/orders/[id]/pay/route.ts` (`payment_url: null`)
- Pricing code : `lib/pricing/service-fee.ts`
