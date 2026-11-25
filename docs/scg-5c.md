# Score de Confiance GWA (SCG) — méthode des 5C

Version du modèle : **5c-v1** · Échelle : **0 à 1000** · Date : 25/11/2026
Code : `lib/scg/five-c.ts` (moteur), `lib/scg/aggregate.ts` (collecte), `lib/scg/persist.ts` (écriture).
Données : fonction SQL `public.scg_5c_inputs(uuid)` (migration 085).

Ce document s'adresse aux partenaires financiers (banques, IMF, sociétés d'affacturage) et à l'équipe GWA.
Le SCG est un **indicateur de confiance**, pas une décision de crédit : la décision appartient au prêteur.

---

## 1. Principe

Le SCG reprend la grille d'analyse crédit classique des **5C** :

| Pilier | Question posée | Poids |
|---|---|---|
| **Caractère** (Character) | Peut-on faire confiance à cette personne ? | **25 %** |
| **Capacité** (Capacity) | A-t-elle des revenus réguliers pour rembourser ? | **25 %** |
| **Capital** | Qu'a-t-elle construit (revenus cumulés, stock, terres, outils) ? | **15 %** |
| **Garanties** (Collateral) | Qu'est-ce qui sécurise un financement ? | **20 %** |
| **Conditions** | Le contexte (filière, saison, zone, prix) est-il favorable ? | **15 %** |

Calcul :

1. chaque pilier est la somme de facteurs, **bornée entre 0 et 100** ;
2. score total = Σ (pilier × poids) × 10, **borné entre 0 et 1000** ;
3. des **plafonds de prudence et anti-fraude** s'appliquent ensuite (§ 6) ;
4. le résultat est accompagné des **3 facteurs qui font monter** et des **3 facteurs qui font baisser** le score, chiffrés en points sur 1000.

Impact d'un facteur sur le total = points du facteur × poids du pilier (en %) ÷ 10.
Exemple : identité vérifiée = 20 points de Caractère × 25 ÷ 10 = **+50 points sur 1000**.

## 2. Seuils

| Score | Badge | Lecture |
|---|---|---|
| 800 – 1000 | Excellence | Très faible risque apparent |
| 600 – 799 | Confirmé | Fiable, historique établi |
| 400 – 599 | Actif | En construction, signaux positifs |
| 200 – 399 | Débutant | Peu d'historique |
| 0 – 199 | Insuffisant | Pas assez de données ou incident |

**Bancable** = score **≥ 500** ET identité vérifiée ET compte non suspendu ET aucune auto-transaction détectée.
Ce drapeau (`scg_bancable`) conditionne l'accès à l'affacturage GWA (`lib/factoring/eligibility.ts`).
Au-delà de 700, la recommandation indique « profil bancable solide ».

## 3. Justification des poids

- **Caractère 25 % et Capacité 25 %** : pour des petits producteurs sans bilan ni garantie réelle,
  la volonté (historique de comportement) et la capacité de payer (flux de ventes vérifiés) sont les
  deux meilleurs prédicteurs du remboursement en microfinance agricole. Ils pèsent la moitié du score.
- **Garanties 20 %** : la force spécifique de GWA est de rendre visibles des garanties « douces » :
  ventes payées en séquestre, créances livrées cessibles (affacturage), caution solidaire de la
  coopérative, parcelles géolocalisées (traçabilité EUDR). Elles réduisent la perte en cas de défaut.
- **Capital 15 %** : les actifs formels sont rares et surtout déclaratifs (surface, matériel) ; on
  privilégie ce qui est prouvé sur la plateforme (revenus encaissés, stock publié).
- **Conditions 15 %** : risque exogène (prix, saison, zone). Important mais peu maîtrisable par
  l'emprunteur ; il module sans dominer.

Ces poids sont une hypothèse de départ (règles expertes, pas d'apprentissage statistique).
Ils seront recalibrés quand GWA disposera d'un historique de remboursements (voir § 8).

## 4. Facteurs, sources et valeurs par défaut

Règle « donnée absente » : on distingue
- les **preuves** (identité, ventes, garanties) : absentes = **0** ;
- les facteurs de **qualité** (avis, engagements tenus, réactivité, paiements) : absents = **40 % du maximum**
  (valeur neutre et prudente : inférieure à la moyenne, jamais un bonus) ;
- les facteurs de **contexte** (filière, saison, prix) : valeur prudente explicite (ci-dessous).

### 4.1 Caractère (25 %) — max 100

| Facteur | Points | Source (table) | Sans donnée |
|---|---|---|---|
| Identité vérifiée | 20 | `profiles.is_verified`, `verification_requests` (approved) | 0 |
| RCCM vérifié | 5 | `profiles.rccm_verified` | 0 |
| Téléphone vérifié (8) + email (2) | 10 | `profiles.phone_verified`, `email` | 0 |
| Ancienneté (1 an = plein) | 15 | `profiles.created_at` | — |
| Avis des acheteurs (moyenne × confiance, 5 avis = confiance pleine) | 20 | `reviews` (hors auto-avis, hors réponses) | 8 |
| Engagements tenus : livrées ÷ (livrées + annulées après paiement + litiges), − retards | 20 | `orders`, `disputes` | 8 |
| Réponse aux messages en moins de 48 h (≥ 3 messages reçus) | 10 | `messages`, `conversations` (horodatage seulement, jamais le contenu) | 4 |
| Incidents : −10 par litige perdu, −15 par signalement confirmé, −5 par échéance payée en retard (max −60) | ≤ 0 | `disputes`, `reports`, `escrow_transactions` | 0 |

### 4.2 Capacité (25 %) — max 100

| Facteur | Points | Source | Sans donnée |
|---|---|---|---|
| Chiffre d'affaires livré 12 mois (log., plein à 5 M FCFA) | 35 | `orders` (delivered/completed) | 0 |
| Nombre de ventes livrées 12 mois (10 = plein) | 20 | `orders` | 0 |
| Régularité : mois avec vente ÷ 12 | 25 | `orders` | 0 |
| Acheteurs différents (4 = plein) | 10 | `orders` | 0 |
| Paiements à temps (comme acheteur) | 10 | `escrow_transactions.paid_at` vs échéance | 4 |

### 4.3 Capital (15 %) — max 100

| Facteur | Points | Source | Sans donnée |
|---|---|---|---|
| Revenus encaissés cumulés (log., plein à 10 M FCFA) | 45 | `orders.vendeur_recoit_fcfa` | 0 |
| Valeur du stock publié, prix × quantité (log., plein à 2 M FCFA) | 25 | `products` publiés (hors brouillon, hors rejet) | 0 |
| Surface exploitée (5 ha = plein) | 15 | `profiles.surface_ha` / `nb_hectares_total` | 0 |
| Stockage ou véhicule | 5 | `profiles.capacite_stockage_tonnes`, `a_vehicule_transport` | 0 |
| Années d'activité (10 ans = plein) | 10 | `profiles.annee_debut_activite` / `experience_years` | 0 |

### 4.4 Garanties (20 %) — max 100

| Facteur | Points | Source | Sans donnée |
|---|---|---|---|
| Ventes payées en séquestre, pas encore livrées (log., plein à 2 M FCFA) | 25 | `orders` (payment_status paid, séquestre non libéré) | 0 |
| Créances affacturables : livrées, non encore versées, **moins** l'affacturage déjà demandé | 20 | `orders`, `factoring_requests` | 0 |
| Caution de coopérative : vérifiée/qualifiée 25, non vérifiée 12 | 25 | `cooperative_members`, `cooperatives` | 0 |
| Parcelle géolocalisée (EUDR) | 15 | `user_places` (champ), `profiles.coordonnees_gps`/lat-long, `products.coordonnees_gps` | 0 |
| Certifications (7,5 par certification) | 15 | `profiles.certif_bio/fairtrade`, `products.certifications` | 0 |

### 4.5 Conditions (15 %) — max 100

| Facteur | Points | Source | Sans donnée |
|---|---|---|---|
| Risque filière (cacao 30, café 27, anacarde/coton 24, palmier 22, hévéa/riz 20, vivriers/artisanat 18, maraîcher/élevage 15) | 30 | `profiles.filieres`, `products.filiere` | 12 |
| Saisonnalité : mois de vente de la filière 20, hors saison 12, production continue 16 | 20 | calendrier § 4.6 | 10 |
| Zone : pays couvert + ville/région connue 20, pays seul 12, hors zone 6 | 20 | `country_configs`, `profiles.city`, `zones_production` | 6 |
| Risque de prix : écart moyen au prix de référence ≤ 10 % → 15, ≤ 25 % → 9, au-delà 3 | 15 | `products.prix_ocpv_ref_fcfa` | 6,75 |
| Diversification : ≥ 2 filières 15, 1 filière 8 | 15 | filières | 5 |

### 4.6 Calendrier de vente (Côte d'Ivoire, hypothèse à valider avec un agronome)

Cacao : oct.–mars et mai–juil. · Café : nov.–mars · Anacarde : févr.–juin · Coton : oct.–janv. ·
Palmier : mars–juil. · Hévéa : toute l'année sauf févr.–mars · Riz : juin–août, nov.–déc. ·
Maïs : juil.–oct. · Igname : août–déc. · Autres filières : production continue.

## 5. Sources de données et couverture (prod, 25/11/2026, 16 comptes)

| Donnée | Table | Couverture | Fiabilité |
|---|---|---|---|
| Email | `profiles` | 100 % | Bonne |
| Téléphone vérifié | `profiles.phone_verified` | 13 % | Bonne (OTP) |
| Identité vérifiée (KYC) | `profiles.is_verified`, `verification_requests` | 6 % (1 compte), 0 demande | Bonne (contrôle admin) |
| RCCM vérifié | `profiles.rccm_verified` | 0 % | — |
| Ville | `profiles.city` | 69 % | Déclaratif |
| GPS | `profiles`, `user_places`, `products` | 19 % | Moyenne (déclaratif géolocalisé) |
| Filières, surface, année de début, certifications profil | `profiles` | 0 % | Déclaratif |
| Coopérative | `cooperatives`, `cooperative_members` | 0 % | Bonne (validation) |
| Commandes | `orders` | 1 commande (500 FCFA) | Bonne (paiement + séquestre) |
| Litiges | `disputes`, `orders.litige_*` | 0 | Bonne |
| Avis | `reviews` | 4 avis, **tous des auto-avis** (exclus) | Bonne après exclusion |
| Séquestre / tranches | `escrow_transactions` | 0 | Bonne |
| Grand livre | `financial_ledger` | 3 écritures | Bonne |
| Retraits wallet | `withdrawal_requests` | 0 | Bonne |
| Solde moyen du wallet | — | **non disponible** (aucune table de solde) | — |
| Produits / stock | `products` | 3 offres, toutes en brouillon | Déclaratif |
| Stock coopératif | `cooperative_stock` | 0 | Déclaratif |
| Affacturage | `factoring_requests` | 0 | Bonne |
| Messages | `messages`, `conversations` | 65 messages, 3 émetteurs | Bonne (horodatage) |
| Signalements | `reports` | 0 | Bonne (modération) |
| Formations | `course_progress` | 0 | Bonne |
| Abonnements | `profiles.subscription_tier`, `subscription_requests` | 1 compte payant | Non utilisé dans le score (voir § 7) |

## 6. Plafonds de prudence et anti-fraude

| Règle | Effet |
|---|---|
| Auto-achat (acheteur = vendeur) | Commande exclue du calcul + Capacité plafonnée à 60 + non bancable |
| Comptes liés (acheteur avec même téléphone ou même email que le vendeur) | Commandes exclues + même plafond |
| Auto-avis (vendeur qui note son propre produit) | Avis exclu + même plafond |
| Concentration : ≥ 3 ventes et un seul acheteur ou > 80 % du CA | Capacité plafonnée à 50 |
| Pic de volume : CA 30 j ≥ 500 000 FCFA et > 3 × la moyenne mensuelle des 5 mois précédents | Capacité plafonnée à 60 (vérification manuelle) |
| Identité non vérifiée | Total plafonné à 499 (jamais bancable) |
| Compte de moins de 90 jours | Total plafonné à 499 |
| Signalement confirmé par la modération | Total plafonné à 299 |
| Compte suspendu | Total plafonné à 199 |

## 7. Ce que le score n'utilise pas

- **Le contenu des messages** : seuls les délais de réponse sont mesurés.
- **L'abonnement payant** : payer GWA n'achète pas de la confiance.
- **Le genre, l'âge, l'ethnie, la religion** : aucune donnée de ce type n'est lue.
- **Les données d'autres plateformes ou de bureaux de crédit** : non connectés à ce jour.

## 8. Limites connues

1. **Peu d'historique** : en novembre 2026, une seule commande réelle existe ; la plupart des scores
   reposent sur le Caractère et les Conditions. Le score est **prudent par construction** (aucun compte
   bancable au dry-run).
2. **Pas de donnée de remboursement** : les poids sont experts, non calibrés statistiquement. Un recalibrage
   (taux de défaut par tranche de score, AUC/Gini) est prévu après 12 mois d'affacturage.
3. **Données déclaratives** (surface, années d'activité, filière, GPS) : utiles mais vérifiables seulement
   par la coopérative ou une visite terrain ; leur poids reste limité (Capital 15 %, Conditions 15 %).
4. **Solde wallet** non disponible : le « solde moyen » du Capital sera ajouté quand le wallet aura une table
   de soldes.
5. **Comptes liés** : détection par téléphone ou email identique seulement (pas d'empreinte d'appareil).
6. **Référentiels filière et saison** : hypothèses à valider (agronome, Conseil Café-Cacao).

## 9. Sécurité et gouvernance

- Calcul **uniquement côté serveur** : `scg_5c_inputs` est `SECURITY DEFINER`, exécutable par `service_role`
  seulement ; aucun membre ne peut écrire `scg_scores`, `scg_history` ni `profiles.scg_*` (migration 084).
- Chaque calcul est historisé (`scg_scores` avec les 5 sous-scores, la version du modèle et l'explication ;
  `scg_history` par jour).
- L'utilisateur voit ses 5C, les 3 facteurs positifs et les 3 négatifs avec un conseil, sur la page Score,
  et peut demander une révision humaine via le support.

## 10. Migrations (ordre d'application)

1. `083_scg_max_1000.sql` — contraintes 0–1000 ;
2. `084_scg_write_lockdown.sql` — écriture réservée au serveur ;
3. `085_scg_5c.sql` — colonnes 5C + `scg_5c_inputs` ;
4. déploiement du code (PR #71) ;
5. recalcul des scores existants (bouton « Recalculer » ou appel admin `/api/scg/calculate`).

Chaque migration a son rollback (`*.rollback.sql`) et une simulation PGlite (`scripts/schema/tests/`).
