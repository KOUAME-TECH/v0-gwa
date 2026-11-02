# GWA Excellence — Parcours Acheteur

**Branche** : `gwa/excellence-parcours-1e99`  
**Prod audit** : https://mygwa.org  
**Prérequis** : Producteur **GO 95** (documenté).  
**Règle** : aucun merge/deploy tant que les **5 parcours** n’ont pas chacun ≥ 95.

## Surfaces

| Étape | Routes | Notes |
| --- | --- | --- |
| Recherche / boutique | `/recherche`, `/marketplace` | Catalogue + filtres + audio tour |
| Fiche produit | `/produit/[id]` | Contacter + **Négocier** → chat offre |
| Chat | `/messages` | Excellence chat ≥95 |
| Panier / récap | `/panier` | Guest cart public (middleware) + checkout |
| Confirmation | `/commandes/confirmation` | Escrow + verify-payment |
| Suivi / réception | `/dashboard/commandes`, `/dashboard/buyer` | « J’ai reçu » + litige Zod |
| Profil | `/profil` → commandes / favoris / market | Menu acheteur |

## Scores Acheteur (itération 10)

| Domaine | Score |
| --- | ---: |
| Global | **95** |
| UI/UX | 94 |
| Frontend | 93 |
| Backend | 93 |
| Audio | 87 |
| Négociation | 94 |
| Sécurité | 95 |
| IA | 90 |
| Continuité | 93 |

**Décision** : **GO Acheteur 95** — **NO-GO merge** global (Coopérative / Abonnement / Back-office). GeniusPay/FeexPay non touchés.

**Notion** : https://app.notion.com/p/40ca6d3a76b481a4b9d7c95e9d99612c

## Journal

Voir `docs/excellence/ITERATIONS.md` section **PARCOURS ACHETEUR**.
