# Plan de test manuel — Parcours Producteur

**Compte** : producteur (farmer) vérifié ou non · Prod https://mygwa.org  
**Branche cible** : preview `gwa/excellence-parcours-1e99` (pas prod tant que <95 ×5)

| # | Étape | Attendu |
| --- | --- | --- |
| 1 | Login → `/dashboard/farmer` | CTA Publier + Commandes ; skip link |
| 2 | Icône portefeuille | Ouvre `/wallet` |
| 3 | CTA KYC si non vérifié | `/profil/verification` |
| 4 | `/publier` produit + photo | Succès → retour farmer |
| 5 | Vocal publier | NS/AEC ; Stop aria |
| 6 | Mode avion → publier texte | File offline + toast ; flush au retour |
| 7 | `/dashboard/products` Partager | Lien `/produit/{id}` copié |
| 8 | `/dashboard/commandes` | Onglet **Mes ventes** par défaut |
| 9 | `/wallet` choisir MTN | Demande retrait réseau MTN (ops) |
| 10 | Guest `/dashboard/farmer` | Redirect login + redirect= |

[ACTION HUMAINE REQUISE] Compte test Playwright credentials.
