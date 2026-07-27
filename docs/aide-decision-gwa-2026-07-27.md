# Aide à la décision GWA — synthèse complète (27 juil. 2026)

**Pour :** Kouamé Yao Wilfried — KOUAME Corporation  
**Sources croisées :** prod live, repo, BP 23/07, cahier 12/24, dossier FeexPay 12–27/07, ops go-live, doctrine banques  
**Objectif :** trancher vite, dans le bon ordre, sans disperser l’énergie avant le 1er sept.

---

## 0. Photo nette (où tu en es)

| Couche | État | En une phrase |
|--------|------|----------------|
| **Produit / code** | Fort | PWA en prod, healthy, offline v20, escrow métier en code, SCG v1, admin, feed, panier… |
| **Paiement live** | Bloqué | FeexPay = passerelle (pas séquestre) ; `payment_url` encore `null` ; sandbox à obtenir |
| **Auth SMS** | Bloqué ops | Africa’s Talking live à valider (checklist go-live) |
| **Revenus** | Ambigu | 3 grilles différentes (BP canal / code abo / négo FeexPay) |
| **Finance Seed** | Draft | BP ~3,6/5 — investissable après P0 (chiffres + traction + grille unique) |
| **Banques** | Clair | Partenaires, pas concurrents — à garder partout |
| **Relation FeexPay** | Fragile mais ouverte | No-shows 16–20/07 ; accord de principe 27/07 ; avenant pas signé |
| **Calendrier** | Serré | ~5 semaines jusqu’au 1er sept. bêta publique |

**Verdict global :** tu as un **vrai produit** et un **bon récit**, mais tu risques de rater le go-live si tu continues à négocier des % pendant que sandbox + OTP + `payment_url` ne sont pas faits. La décision n°1 n’est pas « 3 % ou 4 % » — c’est **« quoi faire cette semaine pour pouvoir encaisser et onboarding SIDONOBIEL »**.

---

## 1. Les 7 décisions à prendre (avec recommandation)

### Décision A — Nature de l’escrow

| Option | Description | Risque |
|--------|-------------|--------|
| A1 | Attendre un vrai séquestre chez l’agrégateur | Retard indéfini ; FeexPay ne le vend pas |
| A2 | **Escrow applicatif GWA** (recommandé) : pay-in → fonds compte KOUAME → pay-out après confirmation | OK produit ; validation juridique BCEAO / CGV |
| A3 | Changer d’agrégateur pour un escrow natif | 2–3 mois perdus ; pas garanti avant sept. |

**Recommandation : A2.**  
Assumer publiquement : *« argent protégé jusqu’à confirmation, orchestré par GWA via partenaire agréé »*.  
Action : CGV + 1 avis juridique court (détention / ordre de fonds).

---

### Décision B — Partenaire paiement (FeexPay)

| Option | Quand la choisir |
|--------|------------------|
| B1 **Rester FeexPay** (recommandé court terme) | Sandbox sous 7–10 j + avenant pilote ; exclusivité **non** |
| B2 Dual (FeexPay + plan B CinetPay/autre) | Si sandbox refuse ou payout API faible |
| B3 Quitter FeexPay maintenant | Seulement si relation morte — **trop tôt** après le 27/07 |

**Recommandation : B1 avec filet B2.**  
Cette semaine : mail court sandbox + grille écrite (pas un nouvel essai de forfait 3 % magique).  
**Ne pas** offrir exclusivité 12 mois avant live prouvé.

**Positions tarifaires réalistes :**
- Plan A stretch : 2 % in + out réduit (cible ~3 % cross) ou out gratuit même réseau
- Plan B acceptable : grille 2 %+2 % cross, **UX « même opérateur »** pour payout gratuit
- Plafond virement 50 k : **pilote 6 mois**, pas illimité
- Marge GWA cible : **4–5 %** nette **ou** moins + abo SaaS — mais **une** table unique

---

### Décision C — Grille de revenus GWA (interne)

Aujourd’hui trois vérités se contredisent. Il faut **en choisir une**.

| Option | Modèle | Pour | Contre |
|--------|--------|------|--------|
| C1 | Commission canal (BP 0–8 %) | Simple à pitcher | ≠ code |
| C2 | Frais selon abo acheteur (code 2,5→0,3 %) | Déjà codé | Trop bas vs 5 % visés + FeexPay |
| C3 | **Empilement clair** (recommandé) : FeexPay (users) + marge GWA fixe ~5 % (ou 3–5 selon abo) | Aligné contre-offre 15/07 + réunion | À implémenter / documenter |

**Recommandation : C3** pour la bêta CI.
1. Users paient FeexPay (in/out) — transparent à l’écran  
2. GWA prélève **commission plateforme** (ex. 5 % free, 4 % coop vérifiée / PRO)  
3. Abonnements = levier rétention / baisse de commission, **pas** seul revenu An.1  
4. Mettre à jour `lib/pricing` + BP + admin settings = **même chiffres**

---

### Décision D — Date go-live 1er septembre

| Option | Signification |
|--------|----------------|
| D1 | Soft launch 1er sept. **même sans** paiement live (catalogue + lead WhatsApp) | Possible mais **ne pas** appeler ça « escrow live » |
| D2 | **Go-live escrow** seulement si sandbox + pay-in + 1 payout test OK (recommandé) | Peut glisser à mi-sept. — honnête |
| D3 | Reporter publiquement à oct. | Si OTP + paiement toujours rouges au 20 août |

**Recommandation : D2.**  
Annonce interne : *« bêta publique = commerce + paiement protégé opérationnel »*.  
Si paiement pas prêt : soft launch SIDONOBIEL (onboarding, catalogue) **sans** promettre l’escrow live aux acheteurs.

---

### Décision E — Seed / levée

| Option | Timing |
|--------|--------|
| E1 | Lever **maintenant** avec BP v23/07 | Risqué (grille ≠ code, pas de traction chiffrée, paiement pas live) |
| E2 | **Corriger P0 BP + 1 mois de métriques soft** puis lever (recommandé) | Meilleur prix / crédibilité |
| E3 | Attendre escrow live + 3 coops | Idéal mais trésorerie RT suspendue — tension |

**Recommandation : E2** si tu peux tenir 4–8 semaines ; sinon E1 **uniquement** après patch P0 BP (grille unique, F1–F6 unifiés, page traction même à 0, wording escrow applicatif).  
Seuil 50 M = activation RT : garder ; ne pas promettre 150 M comme acquis.

---

### Décision F — Scope produit jusqu’à M+3

| Option | Contenu |
|--------|---------|
| F1 **Freeze bêta** (recommandé) | F1–F6 ops + FeexPay pay-in/out + OTP + 1 coop (SIDONOBIEL) |
| F2 | + Formations / RFQ / multi-pays | Dispersion — non avant M+6 |
| F3 | + Affacturage automatisé | Non — semi-manuel suffit ; banques = partenaires plus tard |

**Recommandation : F1.**  
Tout le cahier 12/24 reste la **carte** ; ce n’est pas le **sprint** d’août.

---

### Décision G — Relation & discipline commerciale

| Règle | Pourquoi |
|-------|----------|
| Zéro no-show | FeexPay a déjà sanctionné le calendrier |
| Un seul fil de relance : sandbox + avenant | Pas 3 pages de re-négociation |
| Pas d’exclusivité avant preuve | Levier déjà brûlé une fois |
| Banques = partenaires dans tout pitch | Déjà acté — ne jamais re-glisser |

---

## 2. Ordre d’exécution (meilleure séquence)

```
SEMAINE 1 (maintenant)
  ├─ Mail FeexPay : sandbox + retour écrit payout/plafond (court)
  ├─ Trancher C3 (grille unique) sur 1 page PDF interne
  ├─ Test OTP Africa’s Talking live (ou plan B SMS)
  └─ Avis juridique 1 page escrow applicatif

SEMAINE 2–3
  ├─ Brancher payment_url + webhook E2E sandbox
  ├─ Brancher pay-out à confirmation livraison
  ├─ CGV / textes UX « argent protégé »
  └─ BP v1.1 (P0) si piste investisseur chaude

SEMAINE 4 – go-live
  ├─ 1 parcours réel SIDONOBIEL (vendeur → acheteur → confirm → payout)
  ├─ Soft ou full launch selon D2
  └─ Métriques semaine 1 (users, SKU, tx, litiges)
```

**Ce que tu ne fais PAS en août :** multi-pays, forfait 3 % à mort, exclusivité, SCG v3, wallet BCEAO, RFQ B2B.

---

## 3. Matrice « si… alors… »

| Si… | Alors… |
|-----|--------|
| Sandbox FeexPay sous 10 j | Rester FeexPay ; coder pay-in/out à fond |
| Sandbox refusée / payout impossible | Activer plan B agrégateur **sans** drama public |
| OTP toujours 401 au 15 août | Login email + WhatsApp manuel pour pilote coop uniquement |
| Avenant tarifaire bloque | Ship en grille standard 2 %+2 % + UX même réseau ; renégocier après volume |
| Seed n’arrive pas avant M7 | Garder RT en equity ; stagiaires INP-HB ; GMV > vanity features |
| Investisseur demande escrow « banque » | Expliquer applicatif + partenaire agréé ; ne pas inventer un séquestre FeexPay |

---

## 4. Score décisionnel (où mettre 100 % d’énergie)

| Domaine | Poids | Score actuel /10 | Action |
|---------|-------|------------------|--------|
| Paiement live (FeexPay) | 30 | 3 | **#1 priorité** |
| Auth OTP | 15 | 4 | #2 |
| Grille revenus unique | 15 | 2 | #3 (1 après-midi) |
| Relation FeexPay | 10 | 5 | #4 (mail + fiabilité) |
| Traction SIDONOBIEL | 15 | 5 | #5 (dès paiement OK) |
| BP / Seed | 10 | 6 | Après P0, pas avant paiement |
| Features 12/24 mois | 5 | 8 (docs) | Freeze |

---

## 5. Décisions recommandées — checklist à cocher

Coche mentalement (ou imprime) :

- [ ] **A2** — Escrow applicatif GWA assumé  
- [ ] **B1** — FeexPay court terme + plan B silencieux  
- [ ] **C3** — FeexPay sur users + commission GWA ~5 % (table unique)  
- [ ] **D2** — Go-live escrow conditionné aux tests ; soft launch sinon  
- [ ] **E2** — Seed après patch BP + début traction (sauf urgence cash)  
- [ ] **F1** — Scope août = paiement + OTP + 1 coop  
- [ ] **G** — Plus de no-show ; pas d’exclusivité prématurée  

---

## 6. Une phrase pour te guider

> **En août, GWA ne gagne pas en négociant 1 point de % — GWA gagne en encaissant une vraie commande SIDONOBIEL de bout en bout.**

Les analyses détaillées restent dans :
- `docs/analyse-business-plan-2026-07-27.md`
- `docs/analyse-dossier-feexpay-2026-07.md`
- `docs/analyse-reunion-fixpay-2026-07-27.md`
- `docs/ops-go-live.md`
- `docs/positionnement-partenaires-bancaires.md`
