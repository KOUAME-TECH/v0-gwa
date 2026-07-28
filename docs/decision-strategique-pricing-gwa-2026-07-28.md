# Décision stratégique GWA — Tarification & monétisation

**Comité :** Direction générale · Stratégie · Pricing · Finance · Produit · GTM · Juridique · Ops terrain  
**Date :** 28 juillet 2026  
**Statut :** DÉCISION RETENUE — à intégrer BP §II / §IV / §VI

---

## 1. DÉCISION FINALE

**On tranche ainsi :**

1. **Abonnement = côté offre (vendeurs)** : producteurs individuels + coopératives.  
2. **Acheteurs retail = Free forever** (pas d’abo pour acheter).  
3. **Acheteurs institutionnels = Entreprise sur devis** (outils B2B, pas un péage d’achat).  
4. **Commission GWA = prélevée sur le vendeur**, selon son palier : **8 % / 6,5 % / 5 % / négo**.  
5. **FeexPay = coût de tuyau**, affiché à part (pas confondu avec la marge GWA).  
6. **Prix retenus (bêta → M+6)** :

| Palier | Prix / mois | Commission |
|--------|-------------|------------|
| FREE | 0 | **8 %** |
| STARTER | **7 500 FCFA** | **6,5 %** |
| PRO | **18 000 FCFA** | **5 %** |
| ENTERPRISE | **Sur devis** (plancher indicatif **45 000 FCFA**) | **≤ 5 %** négocié |

7. Les prix **6 000 / 15 000** étaient **légèrement trop bas** pour un produit escrow+SCG ; on monte d’un cran **sans** tuer l’adoption (FREE reste la porte, Starter reste < 10 k).  
8. **Gros producteurs individuels → PRO.** **Coopératives structurées → ENTERPRISE** (ou PRO si petite coop < ~50 membres actifs).  
9. Affacturage = différenciation / rétention, **pas** revenu An.1 principal.  
10. Banques / IMF = **partenaires**, jamais concurrents.

---

## 2. ANALYSE STRATÉGIQUE

### Pourquoi cette décision
- Un marketplace agri meurt si l’**acheteur** paie un abo pour ouvrir le panier.  
- La valeur (vitrine, volume, SCG, priorité affacturage) est côté **vendeur**.  
- Une seule commission vendeur évite la **double prise** (frais acheteur + commission) qui existe encore dans le code actuel.  
- FREE à 8 % finance l’acquisition ; Starter/Pro convertissent ceux qui vendent déjà.

### Marché
- CI : millions de producteurs, mais **cible An.1** = coopératives + gros individuels structurés (SIDONOBIEL d’abord).  
- Pouvoir d’achat abo : un Starter à 7 500 FCFA est tenable si GMV mensuel ≳ **400–500 k FCFA** (économie de commission 8→6,5 %).

### Adoption
- Onboarding **coop d’abord** (B2B2C) → CAC bas.  
- FREE obligatoire pour la première vente (0 % friction d’entrée produit ; monétisation à la transaction).

### Valeur perçue
- Escrow + SCG + Digest = valeur réelle vs informal.  
- L’abo doit acheter : **moins de commission + plus de visibilité + outils**, pas juste un badge.

### Risque d’exécution
- Paiement live FeexPay encore à finaliser ; pricing doit rester simple à expliquer terrain.  
- OTP : crédits AT OK mais livraison SMS dépend **username live + Sender ID** (voir § OTP).

### Positionnement
- Pas une fintech concurrente des banques : **infrastructure de confiance** qui leur apporte deal flow + donnée.

### Capacité de paiement
- Petit producteur : FREE ou Starter.  
- Gros individuel (volumes réguliers) : PRO 18 k.  
- Coop RCCM multi-membres : ENTERPRISE.

---

## 3. TARIFICATION RECOMMANDÉE

| | FREE | STARTER | PRO | ENTERPRISE |
|--|------|---------|-----|------------|
| **Prix** | 0 FCFA/mois | **7 500** FCFA/mois | **18 000** FCFA/mois | **Sur devis** (plancher ~45 000) |
| **Cible** | Découverte, 1ʳᵉ ventes | Producteur individuel actif | **Gros producteur individuel** | **Coopérative** / réseau / export desk |
| **Type client** | Offre | Offre | Offre | Offre (+ option acheteur B2B) |
| **Commission GWA** | **8 %** | **6,5 %** | **5 %** | **≤ 5 %** (négo, plancher 3,5 %) |
| **Bénéfices** | Publier, vendre, SCG de base, Digest | Annonces illimitées, boost léger, stats simples | Priorité feed/shop, SCG avancé, priorité file affacturage, badge | Multi-rôles coop, multi-users, reporting, API, SLA, account manager |
| **Limitations** | Max **5** annonces actives ; pas de boost | Pas multi-comptes | 1 compte principal (+1 assistant plus tard) | Selon contrat |
| **Justification** | Acquisition | Seuil psychologique < 10 k ; break-even ~GMV 500 k/mois | Prix « sérieux » pour gros volumes | Prix B2B défendable investisseur |

**Exception terrain :** pendant le pilote SIDONOBIEL (≤ 90 jours), PRO offert ou 50 % aux membres désignés par la coop — **écrit, daté, non renouvelable auto**.

**Montée progressive des prix :**  
- Bêta → M+6 : grille ci-dessus.  
- M+7 → M+12 : Starter **10 000** / Pro **22 000** si conversion abo ≥ 6 % et NPS vendeur ≥ seuil interne.  
- Annoncer la hausse **60 jours** avant.

---

## 4. LOGIQUE DE MONÉTISATION

| Question | Réponse |
|----------|---------|
| Facturer les producteurs ? | **Oui** (abo + commission) |
| Facturer les acheteurs retail ? | **Non** (abo) ; ils paient prix + FeexPay pay-in |
| Facturer les deux en abo ? | **Non** — trop de friction |
| Commission côté vendeur ? | **Oui — exclusif** pour la marge GWA |
| Abo coop uniquement ? | **Non** — les **gros individuels** sont PRO ; les coops ENTERPRISE |
| Abo acheteur pro ? | **Oui, optionnel ENTERPRISE** (outils), jamais obligatoire pour commander |
| Règle la plus juste / rentable ? | **FREE pour entrer · abo pour scaler · commission vendeur 5–8 % · FeexPay à part** |

**Qui paie quoi (ticket 100 000 FCFA, vendeur PRO, hors FeexPay) :**  
Acheteur paie 100 000 (+ pay-in FeexPay).  
GWA prélève 5 000.  
Vendeur reçoit 95 000 (− pay-out FeexPay).

---

## 5. DÉCISION SUR LES PRIX

| Proposition | Verdict |
|-------------|---------|
| 6 000 / 15 000 | **Trop bas** pour escrow+SCG + crédibilité Seed ; OK comme prix promo 90 j max |
| 7 500 / 18 000 | **Retenu** — adoption préservée, ARPU défendable |
| > 25 000 Pro immédiat | **Trop haut** en bêta sans preuve GMV |

---

## 6. IMPACT FINANCIER (hypothèses explicites)

**Hypothèses prudentes An.1 (médian) :**  
- 4 000 MAU dont ~1 200 vendeurs touchés  
- Conversion abo payant vendeurs : **5 %** → ~60 payants (mix 70 % Starter / 25 % Pro / 5 % Ent)  
- GMV : **270 M FCFA** (aligné BP)  
- Take rate commission moyen pondéré : **~6,2 %** (mix Free majoritaire + payants)  
- FeexPay non inclus dans revenu GWA

| Indicateur | Hypothèse | Lecture |
|------------|-----------|---------|
| **ARPU abo** (payant) | ≈ 7 500×0,7 + 18 000×0,25 + 45 000×0,05 ≈ **11 100 FCFA/mois** | ~133 k FCFA/an |
| **Revenu abo An.1** | 60 × 11 100 × 12 ≈ **8 M FCFA** | Cohérent ordre de grandeur BP |
| **Revenu commissions** | 270 M × 6,2 % ≈ **16,7 M FCFA** | Priorité n°1 |
| **CAC vendeur** | Quasi nul via coop (temps équipe) ; budgéter **2–5 k FCFA** équivalent temps | LTV/CAC très favorable An.1 |
| **LTV PRO** | 18 k×12 + commissions générées ≈ **216 k +** | Churn cible **< 8 %/mois** après M+3 |
| **Payback abo** | < 1 mois si CAC terrain | OK |
| **Marge brute** | > 85 % (logiciel) avant OPEX équipe | Normal SaaS+marketplace |
| **Seuil rentabilité** | ~**35–40 M FCFA** revenu annuel à OPEX post-levée | An.3 dans BP ; An.1 reste déficit volontaire |

Sensibilité : si conversion abo = 3 % seulement, revenus abo ~4,8 M — **toujours viable** si commissions tiennent.

---

## 7. PLAN D’ACTION

### Court terme (0–30 j)
1. Corriger livraison OTP (AT_USERNAME live + AT_SENDER_ID « GWA » approuvé).  
2. Implémenter grille dans `lib/pricing` + commandes (commission selon **abo vendeur** ; plus de double fee acheteur).  
3. Mettre à jour BP §II/IV/VI avec cette grille.  
4. Offre pilote SIDONOBIEL écrite (90 j).  
5. Sandbox FeexPay + 1 parcours pay-in/out.

### Moyen terme (M+1–M+6)
6. Instrumentation : funnel FREE→STARTER→PRO, GMV/vendeur, churn.  
7. A/B discret Starter 6 k vs 7,5 k **uniquement** hors pilote coop (si volume).  
8. Validation juridique CGV (qui paie commission, litige, escrow applicatif).  
9. Pack ENTERPRISE one-pager pour 2ᵉ/3ᵉ coop.

### Long terme (M+7–M+24)
10. Hausse tarifaire annoncée si métriques OK.  
11. Affacturage automatisé **avec banque/IMF partenaire** (revenu secondaire).  
12. Expansion pays : recalibrer prix locaux (pas copier-coller FCFA).

---

## 8. RISQUES ET PARADES

| Risque | Parade |
|--------|--------|
| Commercial — refus prix | FREE + pilote 90 j ; preuve escrow avant upsell |
| Pricing — trop bas (sous-monétisation) | Grille 7,5 / 18 k + revue M+6 |
| Pricing — trop haut | Mesurer churn 30 j ; rollback Starter à 6 k si conversion < 2 % |
| Technique — OTP non reçu | Username live + Sender ID ; health `sms_delivery_ready` |
| Technique — paiement | Escrow applicatif + FeexPay ; pas promettre séquestre agrégateur |
| Réglementaire — détention fonds | Avis juridique ; CGV claires ; partenaire agréé BCEAO |
| Partenaire FeexPay | Pas d’exclusivité avant live ; plan B agrégateur |
| Adoption terrain | Onboarding coop + Digest + formation 1 jour |
| Financier — Seed retardée | Équipe capital-efficient ; focus GMV commissions |

---

## 9. MESSAGE EXÉCUTIF FINAL

**Interne :**  
« On vend la confiance. FREE pour entrer, abo pour les vendeurs qui scalent, commission 5–8 % côté offre. Acheteurs retail = zéro abo. Banques = partenaires. »

**Coopératives :**  
« Vous vendez mieux, vous êtes payés après confirmation, et plus vous montez de palier, plus vous gardez de marge. Pack coop sur mesure. »

**Acheteurs :**  
« Vous achetez sans abonnement. Votre argent est protégé jusqu’à la confirmation de livraison. »

**Investisseurs :**  
« Marketplace agri avec take rate transactionnel + SaaS vendeur. Unit economics sains via acquisition coop. Finance (affacturage) en phase 2 avec partenaires bancaires — nous ne sommes pas une banque. »

---

## OTP — diagnostic (preuve runtime 28/07)

| Fait | Preuve |
|------|--------|
| API renvoie succès | `POST /api/auth/send-otp` → 200, `provider: africastalking` |
| Crédits / clé | Health `SMS_AT: true` |
| SMS non reçu | Typique **username sandbox** et/ou **Sender ID non approuvé CI** (queued ≠ delivered) |

**Actions fondateur (15 min) sur Vercel :**
1. `AT_USERNAME` = username **live** (pas `sandbox`) ; `AT_SANDBOX` absent ou false  
2. `AT_SENDER_ID` = ID alphanumérique **approuvé** (ex. `GWA`) auprès AT pour la CI  
3. Redéployer → `/api/health` doit montrer `SMS_AT_USERNAME_LIVE: true`, `SMS_AT_SENDER_ID: true`, `sms_delivery_ready: true`  
4. Renvoyer un OTP sur ton numéro

Correctifs code poussés : priorité AT, refus sandbox en prod, warning Sender ID, health enrichi.

---

**Recommandation retenue :** abonnements vendeurs Free / **7 500** / **18 000** / Entreprise devis ; commission vendeur **8 / 6,5 / 5 %** ; acheteurs retail non abonnés ; FeexPay à part ; banques partenaires.

**Prochaine action :** (1) fixer `AT_USERNAME` live + `AT_SENDER_ID` sur Vercel et retester OTP ; (2) valider cette grille en comité 10 min puis implémenter dans le code pricing.
