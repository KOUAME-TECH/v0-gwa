# Décision revenus GWA — abonnements + commissions (28 juil. 2026)

**Objectif :** te calmer et trancher **une** grille claire, juste pour la CI, alignée produit + FeexPay.  
**Contexte :** tu as choisi Free / Starter **6 000** / Pro **15 000** / Entreprise **sur devis**, et commissions **5 à 8 %** selon l’abo.

---

## 1. OTP / Africa’s Talking — vérification

| Signal | Résultat |
|--------|----------|
| Prod `/api/health` | `SMS_PROVIDER: true`, **`SMS_AT: true`**, `OTP_PEPPER: true` |
| Crédits AT achetés | Confirmé par toi |
| Checklist ops | Secrets présents côté Vercel (lecture health) |

**Verdict :** côté config plateforme, l’OTP SMS est **vert**.  
**À faire une seule fois (2 min) :** depuis l’app prod, envoie un code sur **ton** numéro CI. Si le SMS arrive → tu peux **fermer le sujet OTP** mentalement et passer à FeexPay / revenus.

*(Un test `curl` sans Origin est bloqué CSRF — normal ; le vrai test = l’écran login.)*

---

## 2. La bonne décision (recommandation nette)

### Qui paie l’abonnement ?

| Rôle | Abonnement ? | Pourquoi |
|------|--------------|----------|
| **Producteur / coopérative (vendeur)** | **Oui** — Free / Starter / Pro / Entreprise | C’est eux qui monétisent la vitrine, le volume, le SCG, l’affacturage |
| **Acheteur particulier / PME** | **Non** (reste Free) | Friction d’achat = mort du marketplace ; ils paient déjà le produit + frais FeexPay |
| **Acheteur institutionnel / exportateur** | **Optionnel Entreprise** (devis) | Multi-users, API, RFQ, reporting — pas pour « droit d’acheter » |

**Décision :** abonnements = **outil vendeur** (+ Entreprise B2B acheteur sur devis).  
Pas d’abo Starter/Pro obligatoire pour les acheteurs.

### Qui paie la commission GWA (5–8 %) ?

| Option | Effet | Verdict |
|--------|-------|---------|
| Chez l’**agriculteur / vendeur** (recommandé) | Standard marketplace ; prix catalogue = prix affiché ; vendeur net = prix − commission − payout FeexPay | **Oui** |
| Chez l’**acheteur** (frais service) | Panier plus cher ; double sensation de « taxes » avec FeexPay | Non en principal |
| Les deux (comme le code aujourd’hui) | `service_fee` acheteur **+** `commission` 5 % vendeur = **double prise** | **À supprimer** |

**Décision :** **une seule commission GWA, prélevée sur le vendeur**, selon **l’abonnement du vendeur**.  
L’acheteur paie : prix produit + frais FeexPay pay-in (transparence).  
Le vendeur reçoit : prix − commission GWA − frais FeexPay pay-out.

---

## 3. Grille recommandée (tes prix, calés 5–8 %)

### Abonnements vendeur (FCFA / mois)

| Palier | Prix | Pour qui | Commission GWA | Limites / avantages (bêta) |
|--------|------|----------|----------------|----------------------------|
| **FREE** | 0 | Découverte, 1ʳᵉ ventes | **8 %** | Annonces limitées (ex. 5 actives), commission max |
| **STARTER** | **6 000** | Producteur actif | **6 %** | Annonces illimitées, meilleure visibilité |
| **PRO** | **15 000** | Coop / gros volume | **5 %** | Badge vérifié, SCG avancé, priorité file affacturage |
| **ENTREPRISE** | Sur devis | Coop réseau / export / multi-comptes | **5 % ou moins** (négo) | Multi-users, API, SLA, reporting |

### Pourquoi ces prix sont « justes » en CI

| Palier | Lecture terrain |
|--------|-----------------|
| **6 000** | ~200 FCFA/jour — un producteur qui vend **≥ ~300 000 FCFA/mois** récupère l’abo rien que via l’écart 8 %→6 % (2 % d’économie) |
| **15 000** | Pour une coop : ~500 FCFA/jour — rentable dès **~500 000 FCFA/mois** de GMV via l’écart 8 %→5 % (+ outils) |
| **8 → 5 %** | Dans ta fourchette 5–8 % ; FREE reste accessible ; PRO récompense le volume |

### Exemple concret (commande 100 000 FCFA, hors FeexPay)

| Abo vendeur | Commission GWA | Vendeur reçoit (avant payout) |
|-------------|----------------|-------------------------------|
| Free | 8 000 (8 %) | 92 000 |
| Starter | 6 000 (6 %) | 94 000 |
| Pro | 5 000 (5 %) | 95 000 |

FeexPay (ex. 2 % in + 2 % out cross-réseau) reste **à part**, affiché clairement — ce n’est pas la marge GWA.

---

## 4. Ce qu’il ne faut plus faire (pour te calmer)

1. **Ne plus empiler** frais acheteur (code actuel 2,5 %) **et** commission vendeur 5 %. → Une seule marge GWA.  
2. **Ne pas** forcer les acheteurs en Starter/Pro.  
3. **Ne pas** mêler « forfait FeexPay 3 % » et « commission GWA 5–8 % » dans la même case — deux lignes distinctes à l’écran.  
4. **Ne pas** rouvrir OTP tant que ton SMS test perso est OK.  
5. **Ne pas** offrir exclusivité FeexPay 12 mois avant sandbox + 1 paiement réel.

---

## 5. Alignement code actuel → cible

| Aujourd’hui | Cible |
|-------------|--------|
| `service_fee` selon **abo acheteur** (2,5→0,3 %) | **0** (ou symbole « frais paiement » FeexPay seulement) |
| `commission_pct = 5` fixe sur vendeur | **8 / 6 / 5** selon **abo vendeur** |
| BP : 0–8 % canal + abo 3 k / 10 k | Remplacer par **cette grille** (6 k / 15 k) |
| Contre-offre FeexPay : « GWA garde 5 % » | = commission **PRO** ; FREE/STARTER plus haut — OK si tu l’expliques |

---

## 6. Checklist décision (à cocher)

- [x] OTP : secrets AT verts en prod — **valider 1 SMS sur ton téléphone** puis classer  
- [ ] **Abo = vendeurs** (+ Entreprise acheteur B2B sur devis)  
- [ ] **Commission = vendeur**, 8 % / 6 % / 5 % selon Free / Starter / Pro  
- [ ] Prix abo : **0 / 6 000 / 15 000 / devis**  
- [ ] FeexPay = coût paiement séparé (users), pas confondu avec marge GWA  
- [ ] Mettre à jour code + BP + écran panier/facture avec **cette** table  
- [ ] Ensuite seulement : sandbox FeexPay + `payment_url`

---

## 7. Phrase pour toi

> Les acheteurs achètent sans friction. Les vendeurs paient l’abo s’ils veulent vendre plus et garder plus. GWA gagne sur la commission (5–8 %) + les abos Starter/Pro. FeexPay n’est pas ta marge — c’est le tuyau.

Quand tu dis **OK sur cette grille**, on peut l’implémenter dans `lib/pricing` + commandes (et aligner le BP) en un lot propre.
