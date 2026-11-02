# GWA Excellence — Parcours Acheteur

**Branche** : `gwa/excellence-parcours-1e99`  
**Prod audit** : https://mygwa.org  
**Prérequis** : Producteur **GO 95** (documenté).  
**Règle** : aucun merge/deploy tant que les **5 parcours** n’ont pas chacun ≥ 95.  
**Scope session** : Acheteur uniquement jusqu’à ≥ 95 — **pas** de Coopérative avant.

## Surfaces

| Étape | Routes | Notes |
| --- | --- | --- |
| Recherche / boutique | `/recherche`, `/marketplace` | Catalogue + filtres + audio tour |
| Fiche produit | `/produit/[id]` | Contacter + **Négocier** → chat offre |
| Chat | `/messages` | Déjà excellence chat ≥95 |
| Panier / récap | `/panier` | Guest cart + checkout (GeniusPay **non modifié** hors CSRF wrapper) |
| Confirmation | `/commandes/confirmation` | Suivi + verify-payment |
| Suivi / réception | `/dashboard/commandes`, `/dashboard/buyer` | Escrow + « J’ai reçu » |
| Profil commandes | `/profil` → commandes / favoris / market | Menu acheteur |

## Mapping scores (§8 adapté Acheteur)

| Domaine | Signification Acheteur |
| --- | --- |
| UI/UX | Clarté FR, Contacter/Négocier, panier invité, WCAG targets |
| Frontend | Responsive, labels statut FR, redirects auth |
| Backend | CSRF + RL confirm/litige/orders, RLS orders buyer |
| Audio | ListenMic fiche + shop voice tour (héritage catalogue) |
| Négociation | CTA Négocier → offre chat structurée |
| Sécurité | Auth gates buyer/commandes/messages ; CSRF mutations |
| IA | Yelly marketplace (héritage) |
| Continuité | Guest cart localStorage + catalog cache offline |

## MCP

| MCP | Statut |
| --- | --- |
| Supabase | OK — advisors WARN HIBP only |
| Playwright | OK — gates + screenshots |
| Notion | Sync agent |
| Serena | À tenter |
| gh | OK |
| GeniusPay/FeexPay | **Non modifiés** (CSRF same-origin sur `/pay` uniquement) |

## Journal

Voir `docs/excellence/ITERATIONS.md` section **PARCOURS ACHETEUR**.

## Scores Acheteur (itération 1)

| Domaine | Score |
| --- | ---: |
| Global | **82** |
| UI/UX | 86 |
| Frontend | 86 |
| Backend | 84 |
| Audio | 72 |
| Négociation | 88 |
| Sécurité | 90 |
| IA | 80 |
| Continuité | 80 |

**Décision** : Itération suivante (82 < 95) — **NO-GO** Coopérative / merge.

**Notion** : https://app.notion.com/p/40ca6d3a76b481a4b9d7c95e9d99612c
