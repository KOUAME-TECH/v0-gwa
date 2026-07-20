# Matrice de test bêta — 7 profils GWA

Cible GO : **1er septembre 2026**. Scope F1–F6 uniquement.

| # | Profil | N cibles | Compte type | Parcours critique | Critères PASS |
|---|--------|----------|-------------|-------------------|---------------|
| 1 | Producteur agricole | 3–5 | `user_type=producteur` | Publier offre → recevoir commande → escrow → livraison → SCG mis à jour | Produit visible marketplace ; statut commande cohérent ; score SCG > 0 après transactions |
| 2 | Coopérative | 1–2 | `user_type=cooperative` | Vitrine membres → ventes agrégées → invitation lien → (option) affacturage | Dashboard coop non vide ; invite copie le lien ; pas de CTA « bientôt » cliquable trompeur |
| 3 | Acheteur | 2–3 | `user_type=acheteur` | Catalogue → panier → commande → validation livraison → facture | Facture `/facture/[id]` ; chat 1:1 vendeur |
| 4 | Bénéficiaire affacturage | inclus dans 1–2 | SCG ≥ 500 | `/affacturage` → demande → file `/admin/factoring` → décision | Acheteur **ne peut pas** POST `/api/factoring` (403 `ROLE_NOT_ELIGIBLE`) |
| 5 | Admin back-office | 1 | `admin_roles` actif | KPIs, modération users/products, file affacturage, export CSV | Badges rôles visibles post-035 ; mutations via `/api/admin/*` |
| 6 | Banque / partenaire pilote | 1 informel | hors plateforme | Reçoit export CSV factoring + NDA par email sécurisé | Pas de `/partner` en bêta ; pas de PII brute non contractuelle |
| 7 | SCG partiel | via producteur/coop | score < 500 | Voir score + message « Score requis » sur bloc affacturage | Dimensions v1 visibles `/scg` et `/admin/scg` |

## Checklist smoke (à chaque merge `main`)

1. `npm test`
2. `node scripts/smoke-audit.mjs` (si URL prod/preview dispo)
3. `GET /api/health` → 200 + DB connected
4. Login email + (si AT live) OTP SMS
5. Producteur : publier produit avec image compressée
6. Acheteur : ouvrir `/produit/[id]` (pas « introuvable »)
7. Affacturage : rôle + SCG gates
8. Admin : `/admin/users` affiche rôles admin

## Hors scope (ne pas tester comme features bêta)

Formations, réseau social, B2B RFQ, wallet BCEAO, appels WebRTC, dashboard banque UI, SCG v2 5C FastAPI.
