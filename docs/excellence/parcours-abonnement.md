# GWA Excellence — Parcours Abonnement

**Branche** : `gwa/excellence-parcours-1e99`  
**Prérequis** : Producteur · Acheteur · Coopérative GO 95

## Surfaces

| Route | Notes |
| --- | --- |
| `/abonnement` | Paliers vendeur + WhatsApp activation |
| `POST/GET /api/subscriptions/request` | CSRF + RL + Zod |
| `POST /api/subscriptions/activate` | Ops (CSRF) — **pas** GeniusPay API |
| `/admin/subscriptions` | Validation manuelle |

## Scores (itération 6)

| Domaine | Score |
| --- | ---: |
| Global | **95** |
| UI/UX | 94 |
| Frontend | 93 |
| Backend | 94 |
| Audio | 70 |
| Négociation | 88 |
| Sécurité | 95 |
| IA | 80 |
| Continuité | 90 |

**GO Abonnement** — activation MM via WhatsApp (humain). GeniusPay non touché.
