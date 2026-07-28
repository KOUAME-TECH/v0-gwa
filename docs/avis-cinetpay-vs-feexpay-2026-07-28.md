# CinetPay vs FeexPay — avis stratégique GWA (28 juil. 2026)

**Contexte :** clarification CinetPay — 3 % = pay-in uniquement ; séquestre sans frais ; pay-out forfaitaire ~0–300 FCFA.  
**Question :** CinetPay est-il une alternative crédible pour l’escrow GWA ?

---

## Verdict (une phrase)

**Oui comme plan B / dual — pas comme pivot immédiat.** CinetPay est **structurellement plus proche** de la promesse « argent bloqué » ; FeexPay reste le chemin **le plus court** si sandbox + `payment_url` arrivent cette semaine. Ouvre CinetPay **en parallèle**, sans exclusivité FeexPay.

---

## 1. Ce que change CinetPay

| Point | FeexPay (dossier 12–27/07) | CinetPay (info reçue) |
|-------|---------------------------|------------------------|
| Nature | Passerelle : fonds sur compte KOUAME | **Séquestre** : fonds immobilisés compte dédié |
| Pay-in | ~**2 %** MM CI | ~**3 % + 50–100 FCFA** |
| Séquestre | Non (orchestration GWA) | **Oui, 0 FCFA** pendant le blocage |
| Pay-out | ~**2 %** (0 % même réseau) | **0–300 FCFA** forfait |
| Alignement BP « argent protégé » | Applicatif (juridique + CGV) | **Plus naturel** (blocage chez agrégateur) |
| Go-live GWA | En cours (sandbox bloquant) | À ouvrir (compte + API + test release) |

**Lecture :** CinetPay gagne sur la **crédibilité escrow** ; FeexPay gagne souvent sur le **% pay-in** (2 vs 3) et sur la relation déjà ouverte.

---

## 2. Tableau chiffré — coût tuyau « in + séquestre + out »

Hypothèses CinetPay : pay-in **3 % + 75 FCFA** (milieu 50–100) ; séquestre **0** ; pay-out **200 FCFA** (milieu 100–300).  
Hypothèses FeexPay cross-réseau : **2 % in + 2 % out** (grille CR) ; même réseau : **2 % in + 0 % out**.

| Panier | CinetPay (total tuyau) | FeexPay cross (2+2) | FeexPay même réseau (2+0) | Gagnant coût |
|--------|------------------------|---------------------|---------------------------|--------------|
| **1 000** | 30+75+200 = **305** (30,5 %) | 40 = **40** (4 %) | 20 = **20** (2 %) | FeexPay |
| **5 000** | 150+75+200 = **425** (8,5 %) | 200 = **200** (4 %) | 100 = **100** (2 %) | FeexPay |
| **10 000** | 300+75+200 = **575** (5,8 %) | 400 = **400** (4 %) | 200 = **200** (2 %) | FeexPay |
| **50 000** | 1 500+75+200 = **1 775** (3,6 %) | 2 000 = **2 000** (4 %) | 1 000 = **1 000** (2 %) | CinetPay ≈ cross ; FeexPay même réseau |
| **100 000** | 3 000+75+200 = **3 275** (3,3 %) | 4 000 = **4 000** (4 %) | 2 000 = **2 000** (2 %) | CinetPay vs cross |

**Impact GWA (ticket 5 000, vendeur FREE 8 % commission) :**

| | CinetPay | FeexPay cross |
|--|----------|---------------|
| Tuyau | ~425 | ~200 |
| Commission GWA (8 %) | 400 | 400 |
| **Total frais visibles** | ~825 (16,5 %) | ~600 (12 %) |

Sur petits paniers agri (1–5 k), les **frais fixes CinetPay tuent** l’expérience. Sur paniers coop (50–100 k), CinetPay devient **compétitif vs FeexPay cross** et offre le séquestre.

---

## 3. Mon avis (tranché)

### Ce qui est bon chez CinetPay
1. **Séquestre réel** → plus proche de la promesse BP / confiance terrain.  
2. Pay-out forfaitaire = prévisible sur gros tickets.  
3. Argument négociation FeexPay : *« on a une alternative avec blocage natif »*.  
4. Cohérent avec la décision déjà prise : **pas d’exclusivité FeexPay**.

### Ce qui est dangereux
1. **Petits paniers** (typiques retail GWA) : 30 % de frais tuyau sur 1 000 FCFA = adoption morte.  
2. 3 % pay-in > 2 % FeexPay : à absorber ou à faire payer clairement (tuyau ≠ marge GWA).  
3. Changer d’agrégateur **maintenant** = 2–4 semaines perdues alors que FeexPay est déjà dans le tunnel.  
4. « Séquestre » marketing ≠ API release/refund testée — **à prouver en sandbox**.

### Recommandation d’exécution

| Priorité | Action |
|----------|--------|
| **P0** | Continuer FeexPay : sandbox + 1 pay-in → confirm → pay-out **cette semaine** |
| **P0** | Ouvrir un dossier CinetPay **en parallèle** (compte marchand + doc API séquestre release/refund) |
| **P1** | Dual-write abstraction paiement (`provider: feexpay \| cinetpay`) — déjà prévu comme filet B2 |
| **P1** | UX « même opérateur MM » si FeexPay (payout 0 %) — réduit le coût vs CinetPay sur petits tickets |
| **Non** | Ne **pas** quitter FeexPay avant 1 cycle live prouvé **ou** échec sandbox écrit |
| **Non** | Ne **pas** promettre exclusivité à qui que ce soit |

**Règle produit à afficher :**  
*« Frais de paiement (partenaire) »* séparés de *« commission GWA vendeur 5–8 % »* — déjà tranché DG 28/07.

---

## 4. Quand basculer vers CinetPay en principal

Basculer **seulement si** ≥ 2 de ces conditions :
1. FeexPay sandbox / `payment_url` / payout API bloqués > 10 jours.  
2. CinetPay prouve API : create hold → release vendeur → refund acheteur.  
3. Panier moyen GWA réel ≥ **~15–20 k FCFA** (coops) où le forfait out devient négligeable.  
4. Avis juridique : séquestre CinetPay = meilleur wording CGV que détention compte KOUAME.

Sinon : **FeexPay primary + CinetPay backup**.

---

## 5. Phrase pour répondre à CinetPay / à toi-même

> Le 3 % CinetPay est un pay-in clair ; le séquestre gratuit est un vrai avantage produit. Pour GWA, on ouvre CinetPay en plan B dual, on compare en sandbox le cycle hold/release, et on garde FeexPay tant que le go-live escrow live n’est pas prouvé. Sur paniers < 10 k, on privilégiera l’optimisation même réseau FeexPay ; sur paniers coop, CinetPay peut devenir le tuyau principal.

**Pourquoi c’est la meilleure position :** tu ne sacrifies ni le calendrier (FeexPay), ni la promesse escrow (CinetPay séquestre), ni la grille revenus GWA (tuyau ≠ commission).
