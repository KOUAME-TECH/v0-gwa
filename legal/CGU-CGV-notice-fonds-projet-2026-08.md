# GWA — CGU/CGV & Notice de détention des fonds
## Projet de travail renforcé — 10 août 2026

> **AVERTISSEMENT** — Document de travail pour revue juridique.  
> Domaine réglementé (BCEAO/UEMOA, services de paiement).  
> Validation obligatoire par avocat OHADA / paiement avant publication commerciale.

**Éditeur :** KOUAME Corporation (SASU), RCCM CI-ABJ-03-B17-00098  
Abidjan-Cocody Angré, Carrefour les Oscars, Cité les Papayers, Lot 1232  
kouamecorporation@gmail.com · +225 05 85 82 79 37  
**Produit :** GWA (Green West Africa) — Business Unit de KOUAME Corporation (pas « GWA Group »).

---

## A. Analyse des vecteurs de spéculation / abus (technique ↔ juridique)

Ces scénarios motivent les clauses renforcées des articles 5, 6, 7, 8 et 11 et les correctifs produit associés.

| Vecteur | Mécanisme | Impact | Contre-mesure produit / CGU |
|--------|-----------|--------|------------------------------|
| **Double cash-out** | Confirm déclenche un payout FeexPay **et** le Wallet recompte la même vente `released` pour un second retrait | Fuite de fonds plateforme | Wallet **exclut** les commandes déjà `payout_status=paid` ; un seul modèle de sortie d’argent |
| **Confirm avant livraison** | Acheteur (ou session compromise) confirme dès `confirmed`/`processing` | Payout sans marchandise | Confirmation **uniquement** si `shipped` (+ litige possible tant que fonds `held`) |
| **Course double confirm / double retrait** | Deux requêtes parallèles | Double payout Mobile Money | Claim atomique `escrow_status=held` ; une demande withdraw `pending|processing` à la fois |
| **Survente / stock** | Commande sans contrôle de stock | Spéculation sur rareté / default vendeur | Réservation / refus si `qty > stock` ; décrément au paiement |
| **Manipulation d’offre chat** | RLS messages : tout participant pouvait modifier l’offre | Prix négocié forgé | UPDATE message = auteur seul ; acceptation offre via API serveur |
| **Fake avis → SCG → affacturage** | Insert avis sans preuve d’achat (RLS) | Crédit indu via partenaire | Avis liés commande livrée + unique ; SCG recalculé `score_total` |
| **Gonflage coop** | Join libre par `coop_id` pour atteindre 15 membres | Accès affacturage avancé | Invitation / code ; qualification documentaire |
| **Montant affacturage libre** | Demande jusqu’à 500 M sans lien créance | Spéculation sur avance | Plafond = créances GWA éligibles ; SCG indicatif ≠ engagement |
| **Abo « éternel »** | `subscription_expires_at` non lu | Commission réduite sans paiement | Tier effectif = free si expiré |
| **Float / détention** | Confusion « séquestre FeexPay » / banque | Risque réglementaire & marketing trompeur | Vocabulaire **escrow applicatif** + notice Art. 6 |
| **PII / scraping** | Lecture email/téléphone profiles ouverte | Usurpation / phishing | Migration PII + révocation GRANT |

**Interdiction de spéculation (clause type à valider avocat) :**  
Sont notamment interdits : (i) multi-comptes collusifs pour fausser SCG, avis ou volume ; (ii) commandes fictives ou auto-achats destinés à obtenir payout, score ou affacturage ; (iii) retraits ou confirmations automatisés visant à extraire un float ; (iv) détournement du Wallet comme instrument de dépôt rémunéré (le Wallet ne produit aucun intérêt).

---

## 1. Objet et champ d’application

Les présentes Conditions Générales de Vente et d’Utilisation (« CGU/CGV ») régissent l’accès et l’utilisation de la plateforme GWA, éditée par KOUAME Corporation (ci-après « GWA » ou « la Société »).

Elles s’appliquent à toute personne créant un compte (producteur, transformateur, coopérative, acheteur, entreprise), ci-après « l’Utilisateur ».

Toute utilisation implique l’acceptation pleine et entière des présentes, y compris la **Notice de détention des fonds (Article 6)**, présentée avant la première transaction payante.

---

## 2. Définitions

| Terme | Définition |
|-------|------------|
| **Escrow applicatif** | Orchestration GWA du blocage puis de la libération des fonds d’une commande via le compte marchand agrégateur du PSP. **Ce n’est pas** un séquestre juridique bancaire ni un dépôt réglementé opéré « par FeexPay ». |
| **Compte marchand agrégateur** | Compte technique du prestataire de services de paiement partenaire (actuellement FeexPay), pour collecte et reversement pour compte de tiers selon le cadre UEMOA applicable. |
| **Wallet** | Solde **comptable** affiché au vendeur : ventes **libérées** (`escrow released`) **et non déjà reversées** vers Mobile Money / banque. Ce n’est **ni** un compte bancaire, **ni** un compte de monnaie électronique détenu par GWA, **ni** un produit d’épargne. |
| **Payout** | Reversement effectif vers le Mobile Money / moyen du vendeur (à la confirmation de réception réussie, ou via retrait Wallet pour les crédits différés). |
| **SCG** | Score de Confiance GWA (0–1000), indicateur interne. Seuil bancable indicatif ≈ 500. |
| **Affacturage digital** | Mise en relation avec un **partenaire financier tiers** pour une avance sur facture GWA. GWA n’accorde pas le crédit. |

Formulation UX autorisée : « **argent protégé** jusqu’à confirmation de réception ».  
Formulations **interdites** : « séquestre FeexPay », « dépôt garanti », « compte escrow GWA ».

---

## 3. Inscription et compte

- Inscription : téléphone CI (+225) + OTP SMS. Email facultatif.
- Type de compte non modifiable en libre-service (validation admin).
- Exactitude des informations et KYC à la charge de l’Utilisateur.
- Coopératives : fonctionnalités avancées (dont affacturage) conditionnées à **≥ 15 membres actifs** (fenêtre 14 jours) + documents légaux (sous 6 mois), selon politique produit en vigueur.
- Compte **suspendu** : accès aux flux payants, publication, retraits et affacturage **refusés**.

---

## 4. Marketplace

- GWA = intermédiaire technique de mise en relation et de sécurisation du paiement.
- GWA n’est ni producteur, ni propriétaire, ni vendeur des biens.
- Exactitude prix / quantité / qualité / certifications = responsabilité du vendeur.
- Panier : **un vendeur à la fois**. Stock insuffisant = refus de commande.
- Offres négociées (chat) : montant accepté côté serveur ; manipulation d’offre = fraude.

---

## 5. Paiement et escrow applicatif

| Étape | Description | Statuts techniques |
|-------|-------------|-------------------|
| 1 | Pay-in acheteur (Mobile Money / moyen PSP) | `payment_status=pending→paid` |
| 2 | Fonds bloqués sur compte marchand agrégateur | `escrow_status=held` |
| 3 | Vendeur prépare / expédie | `confirmed` → `processing` → `shipped` |
| 4 | Acheteur confirme **réception** (uniquement après expédition) | `delivered` ; payout vendeur net commission **ou** crédit Wallet si payout différé |
| 5 | Litige avant / pendant hold | `escrow_status=frozen` ; pas de payout |

**Délai automatique :** à défaut de confirmation ou de litige dans le délai affiché dans l’app (défaut produit : **7 jours** après expédition / statut éligible), GWA peut libérer les fonds selon les règles ops (auto-release), sauf gel litige.

**Litige après « livré » :** tant que les fonds restent `held` (ex. payout en échec), un litige peut rester ouvert côté support.

---

## 6. Notice de détention des fonds (lecture obligatoire avant 1er paiement)

### 6.1 Statut de GWA
GWA n’est **ni** établissement de crédit, **ni** émetteur de monnaie électronique, **ni** institution de microfinance agréée.  
GWA **ne détient pas** les fonds sur un compte bancaire ouvert en son nom au bénéfice des Utilisateurs.  
Les fonds **transitent** par le compte marchand du PSP partenaire.  
GWA = **orchestrateur technique** du moment de libération — pas dépositaire réglementé.

### 6.2 Nature du Wallet
- Représentation comptable des ventes libérées **non encore retirées**.
- **Aucun intérêt**, aucune rémunération, aucun produit d’épargne.
- Retrait vers Mobile Money / moyen désigné, sous délais ops affichés.
- Les ventes déjà payées au vendeur par payout à la confirmation **n’apparaissent pas** comme solde retirable (anti double cash-out).

### 6.3 Délais
- Libération : confirmation acheteur **ou** auto-release selon délai app **ou** décision litige (Art. 11).
- Gel litige jusqu’à résolution support.

### 6.4 Absence de garantie de dépôt
Pas de garantie de type dépôt bancaire. Diligence raisonnable sur le choix du PSP, sans garantie de résultat.

### 6.5 Interdiction d’usage spéculatif du float
L’Utilisateur s’interdit d’utiliser l’escrow applicatif, le Wallet ou les délais de libération comme instruments de placement, d’arbitrage ou de float spéculatif. Tout schéma détecté (multi-comptes, commandes fictives, automation abusive) entraîne suspension et signalement éventuel.

---

## 7. Commissions et abonnements

| Palier | Prix / mois | Commission vendeur |
|--------|-------------|-------------------|
| FREE | 0 | 8 % |
| STARTER | 7 500 FCFA | 6,5 % |
| PRO | 18 000 FCFA | 5 % |
| ENTERPRISE | Sur devis | ≤ 5 % négocié |

- Acheteur retail : **0** commission / abo GWA.
- Activation : demande in-app + validation ops (preuve) — pas de carte bancaire in-app.
- Durée : **30 jours** à compter de l’activation ; à expiration, retour **FREE** (droits et commission).
- Modification de grille : préavis raisonnable.

---

## 8. Affacturage digital

- Mise en relation uniquement ; **décision et décaissement = partenaire tiers**.
- Éligibilité SCG = **indication**, non engagement.
- Montant plafonné par les **créances / commandes GWA éligibles** (pas un montant libre spéculatif).
- Circuit semi-manuel jusqu’à intégration partenaire signé.
- Coop : accès avancé soumis à qualification (Art. 3).

---

## 9. Responsabilités

- Moyens raisonnables, pas de continuité absolue.
- Qualité / livraison des biens = vendeur (sous réserve Art. 5).
- Prestataires tiers (PSP, SMS, hébergement) : diligence raisonnable, pas garantie de résultat.

---

## 10. Données personnelles

Loi n° 2013-450 du 19 juin 2013.  
Finalités : fonctionnement plateforme, SCG, mise en relation financière **avec consentement**.  
Droits d’accès / rectification / suppression via support.  
Email / téléphone : accès restreint (pas de scraping marketplace).

---

## 11. Réclamations et litiges

- Signalement via l’app ; gel des fonds concernés.
- Support statue : libération vendeur, remboursement acheteur (file ops / PSP), ou maintien gel.
- Preuves (photos, échanges) exigibles.
- Remboursement acheteur = process ops + PSP (pas un simple flag écran).

---

## 12. Résiliation

- Clôture à la demande, sous réserve transactions en cours.
- Suspension / clôture pour fraude, violation CGV, abus spéculatif, multi-comptes collusifs.

---

## 13. Droit applicable

Droit ivoirien + Acte uniforme OHADA applicable.  
Juridictions d’Abidjan, Côte d’Ivoire, à défaut d’accord amiable.

---

## Rappel final (ops + juridique)

1. Validation avocat Articles **5, 6, 8** + clause anti-spéculation.  
2. Confirmation écrite FeexPay : statut compte marchand + répartition responsabilités.  
3. Aligner contrat commercial FeexPay et formulations app (« argent protégé »).  
4. Ne pas activer paiement live tant que secrets FeexPay / AT_SENDER_ID / migration PII ne sont pas en place.

---

*KOUAME Corporation — document projet — 10/08/2026*
