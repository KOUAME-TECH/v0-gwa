# Plan de test manuel — Parcours Acheteur

## Prérequis

Compte acheteur staging + vendeur avec produit actif. **Pas** de GeniusPay live obligatoire (simulation hors prod OK).

## Scénarios

| # | Scénario | Attendu |
| --- | --- | --- |
| A1 | Invité : ajouter au panier (marketplace → produit) | Ligne visible `/panier` sans login |
| A2 | Invité : qty +/− / supprimer | Persist localStorage |
| A3 | Invité : Continuer checkout | Redirect login `?redirect=/panier` |
| A4 | Login → panier fusionné | Lignes guest dans `cart_items` |
| A5 | Checkout 3 steps FR | Progress aria ; paiement protégé copy |
| A6 | Confirmation commande | Escrow stepper cohérent |
| A7 | Dashboard buyer « J’ai reçu » | Toast OK ; statut FR |
| A8 | Fiche produit Contacter / Négocier | Négocier ouvre offre chat |
| A9 | Favoris auth | Redirect `?redirect=/favoris` |
| A10 | Offline snapshot panier auth | Toast hors ligne si cache |

## Non-régression

- Producteur `/dashboard/farmer` intact
- GeniusPay secrets / SDK **non modifiés**
