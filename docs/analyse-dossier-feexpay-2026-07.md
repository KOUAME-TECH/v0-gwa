# Dossier FeexPay × KOUAME Corporation — analyse comparative & suggestions

**Périmètre :** fil mail 12–20 juil. 2026 + CR 14 juil. + grille tarifaire + contre-offre Kouamé + réunion 27 juil.  
**Produit :** GWA (Smart Escrow applicatif)  
**Doc lié :** `docs/analyse-reunion-fixpay-2026-07-27.md`

---

## Verdict

FeexPay a **toujours** présenté le même modèle : passerelle pay-in → compte KOUAME → pay-out (pas de séquestre chez eux). La demande initiale GWA (API escrow avec blocage technique) **n’est pas le produit FeexPay**. La contre-offre du 15 juil. est **ambitieuse mais fragile** (3 % tout compris + exclusivité 12 mois + volume X non chiffré). La réunion du 27 juil. **rapproche** les positions sans avenant signé. Priorité : sandbox + table tarifaire unique + reformulation escrow — pas une nouvelle guerre de % sans preuve technique.

---

## 1. Chronologie (faits)

| Date | Événement | Signal |
|------|-----------|--------|
| **12 juil.** | Mail Kouamé : besoin API escrow (bloquer, libérer, rembourser) | Attente produit = **séquestre agrégateur** |
| **13–14 juil.** | RDV + CR FeexPay + grille | Clarification : **passerelle uniquement** ; fonds sur compte KOUAME |
| **15 juil.** | Contre-offre Kouamé (3 % forfait, plafond 50 k, 5 % marge GWA, exclusivité 12 mois) | Négociation commerciale ouverte |
| **15–16 juil.** | FeexPay propose Teams jeudi 10h | Suite logique |
| **~16 & autre** | **2 RDV manqués** par Kouamé (selon Jessica, 20 juil.) | **Risque relationnel élevé** |
| **20 juil.** | Kouamé demande nouveau créneau ; Jessica refuse « cette semaine » | Tension ; FeexPay garde la main sur le calendrier |
| **20 juil.** | Kouamé s’excuse, confirme, redemande un RDV | Réparation partielle |
| **27 juil.** | Réunion : pas de séquestre Fixpay ; marge ~5 % GWA ; 3 % / payout 1 % / plafond 50 k en discussion ; sandbox avant 1er sept. | Accord de **principe**, pas encore avenant |

---

## 2. Comparatif des modèles

### 2.1 Ce que GWA a demandé (12 juil.) vs ce que FeexPay vend (CR 14 juil.)

| Besoin GWA (mail) | Offre FeexPay (CR) | Compatible ? |
|-------------------|--------------------|--------------|
| Bloquer temporairement les fonds (compte technique) | Pas de blocage / pas de séquestre chez FeexPay | **Non** (tel quel) |
| Libérer au vendeur sous conditions | Pay-out déclenché par KOUAME | **Oui** si GWA orchestre |
| Rembourser l’acheteur | Possible via flux inverse / process à spécifier | **Partiel** — à documenter API |
| Collecte MM | Pay-in 2 % (CI) | **Oui** |
| Traçabilité | Notifications / refs transaction | **Oui** (à tester sandbox) |

**Conclusion structurelle :** le « Smart Escrow » GWA = **logique métier GWA** + **trésorerie sur compte marchand KOUAME** + API pay-out FeexPay. Ce n’est pas un escrow FeexPay.

### 2.2 Grille FeexPay (14 juil.) — coût réel d’un cycle escrow GWA

Hypothèse CI, acheteur et vendeur **réseaux différents** :

| Étape | Taux grille | Qui paie (contre-offre Kouamé) |
|-------|-------------|-------------------------------|
| Pay-in MM | **2 %** | Acheteur |
| Pay-out MM | **2 %** | Producteur |
| **Total FeexPay** | **4 %** | Utilisateurs |
| + Commission GWA | **~5 %** (visée) | Selon modèle GWA |
| **Coût visible transaction** | jusqu’à **~9 %** si tout est empilé sans optimisation | Risque adoption |

Points favorables de la grille / CR :
- Pay-out **gratuit** si **même réseau** MM (CR 14 juil.) → argument produit fort (« même opérateur = moins cher »).
- Liberté de facturation côté KOUAME (acheteur / prise en charge).
- Bénin déjà plus bas (pay-in 1,7 % / pay-out 1 %) — utile expansion, hors scope bêta CI.

### 2.3 Contre-offre Kouamé (15 juil.) vs grille vs réunion 27 juil.

| Demande Kouamé | Grille FeexPay | Statut au 27 juil. | Commentaire |
|----------------|----------------|--------------------|-------------|
| Forfait escrow **3 %** tout compris (tous réseaux) | 2+2 = **4 %** cross-réseau | Discuté ; faisabilité payout **1 %** au cas par cas | 3 % forfait = **-1 pt** vs grille ; difficile sur Orange |
| Plafond virement **50 000 FCFA** (0,5 %) | Non listé clairement en grille jointe (cartes 3,5 / 3,9 %) | Noté ; réserve Jessica | Bon levier B2B ; viser pilote |
| Frais FeexPay 100 % sur users ; GWA garde **5 %** | N/A | Accord de principe marge GWA ~5 % | OK **si** users acceptent le cumul |
| Exclusivité **12 mois** | Non demandé par FeexPay | Pas tranché | **Ne pas offrir** sans sandbox + tarifs signés |
| Volume min. **X**/mois | — | X jamais défini | Faiblesse de la contre-offre |
| Avenant | — | En préparation après validation | Bonne cible |

### 2.4 Incohérences internes GWA (prix)

| Source | Logique |
|--------|---------|
| Contre-offre 15/07 | Users paient FeexPay ; GWA **5 %** intact |
| Réunion 27/07 | Proposition **3 %** réparti 2 % acheteur + 1 % producteur (mélange FeexPay + ?) |
| BP | Commissions canal 0–8 % |
| Code | Frais abo acheteur 2,5 % → 0,3 % |

Sans **une** table unique, l’avenant et le P&L An.1 divergeront.

---

## 3. Analyse de la relation commerciale

### Points forts Kouamé
- Besoin clairement exprimé dès le 12 juil.
- Contre-offre structurée (5 points) — niveau « Seed / partenariat ».
- Excuses du 20 juil. + confirmation du CR.

### Points faibles / risques
1. **Deux no-shows** après avoir fixé date/heure/lien → Jessica a raison sur le fond ; coût de confiance.
2. Contre-offre cite **CinetPay / SenePay** sans preuves annexées → argument attaquable.
3. **Exclusivité 12 mois** donnée trop tôt (avant sandbox, avant avenant) = levier gaspillé.
4. Volume **X** non chiffré = engagement creux.
5. Confusion prolongée « compte séquestre FeexPay » alors que le CR du 14 juil. était déjà clair → la surprise du 27 juil. était évitable.

### Position FeexPay
- Professionnelle sur le fond (CR + grille rapides).
- Ferme après les absences (report calendaire) — normal.
- Ouverte le 27 juil. sur marge GWA / étude 1 % / plafond — fenêtre encore ouverte.

---

## 4. Suggestions (priorisées)

### P0 — Cette semaine

| # | Action | Pourquoi |
|---|--------|----------|
| 1 | **Une page tarifaire GWA** : coût FeexPay (même réseau / cross) + marge GWA + qui paie + exemple chiffré 100 000 FCFA | Finir l’ambiguïté 3 % vs 4 % vs 5 % |
| 2 | Relancer **uniquement** sur : sandbox (pay-in + pay-out + refund) + date avenant — ton court, pro, sans re-pitch long | Réparer la relation |
| 3 | **Retirer** l’exclusivité 12 mois de toute offre tant que sandbox + avenant non signés | Garder le levier |
| 4 | Chiffrer un volume pilote réaliste (ex. GMV ou nb tx M1–M3) ou ne rien garantir | Éviter X fantôme |
| 5 | Faire valider juridique : fonds sur compte KOUAME = OK cadre BCEAO / CGV escrow applicatif | Risque structurel |

### P1 — Positions de négociation recommandées

| Sujet | Position suggérée |
|-------|-------------------|
| Forfait 3 % | Objectif **stretch** ; plan B crédible : **2 % in + 1 % out** (ou out gratuit même réseau + out réduit cross) |
| Orange | Accepter **tarif dérogatoire** plutôt que bloquer tout le forfait |
| Même réseau | Mettre en avant le **payout gratuit** (CR) dans l’UX GWA (« choisis le même opérateur ») |
| Virement 50 k | Demander **pilote 6 mois** + revue de revue |
| Marge GWA 5 % | Garder ; la financer via users **et/ou** abo SaaS, pas en compressant FeexPay à mort |
| Exclusivité | 6 mois **après** go-live live, conditionnée à SLA sandbox/prod |

### P2 — Produit & com

| # | Livrable |
|---|----------|
| 6 | Brancher pay-in (`payment_url`) + pay-out à `escrow_status` held→released |
| 7 | Parcours remboursement acheteur (annulation / litige) documenté |
| 8 | Wording public : « argent protégé jusqu’à confirmation » — **pas** « séquestre FeexPay » |
| 9 | UX : hint même réseau MM pour éviter le double 2 %+2 % |
| 10 | Aligner BP + `service-fee.ts` sur la table unique |

### Modèle de mail de relance (suggestion)

> Objet : Suite 27/07 — sandbox + avenant  
> Bonjour Jessica, Yann, Fatime,  
> Merci pour l’échange du 27 juillet et vos clarifications sur le flux pay-in / pay-out.  
> Pour tenir notre bêta du 1er septembre, nous avons besoin de : (1) accès sandbox pay-in + pay-out + scénario remboursement ; (2) votre retour écrit sur le payout 1 % (hors Orange si besoin) et le plafond virement 50 000 FCFA en pilote.  
> Dès validation, nous pourrons finaliser l’avenant.  
> Bien cordialement, Yao — KOUAME Corporation / GWA

---

## 5. Score du dossier (à date)

| Critère | /5 | Commentaire |
|---------|-----|-------------|
| Clarté modèle FeexPay | 5 | CR 14 juil. déjà limpide |
| Alignement besoin GWA initial | 2 | Escrow agrégateur non fourni |
| Qualité contre-offre 15/07 | 3,5 | Structurée ; exclusivité + X faibles |
| Gestion relation (no-shows) | 2 | Coût de confiance |
| Avancée 27/07 | 4 | Fenêtre tarifaire encore ouverte |
| Prêt go-live 1er sept. | 2,5 | Sandbox + intégration manquantes |
| **Global** | **≈ 3,2 / 5** | Dossier **récupérable** si exécution technique + discipline commerciale |

---

## 6. Synthèse en une phrase

FeexPay est le bon type de partenaire **passerelle** ; GWA doit assumer l’**escrow applicatif**, négocier une **grille réaliste** (pas un 3 % magique cross-réseau), **réparer la relation** après les absences, et **prouver** sandbox avant d’offrir exclusivité ou volumes.
