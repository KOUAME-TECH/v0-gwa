# Continuité — Parcours Acheteur

## Offline / guest

- `lib/cart/guest.ts` — panier localStorage `gwa_guest_cart_v1`
- Merge post-login `mergeGuestCartToUser`
- Snapshot auth `lib/offline/cart-snapshot.ts` si réseau KO
- Catalog cache pour résoudre noms produits hors ligne

## Restore dry-run

1. Exporter table `cart_items` + `orders` (buyer_id) staging
2. Vérifier RLS : acheteur ne lit que ses lignes
3. Simuler perte localStorage guest → panier vide attendu (pas de sync cloud guest)
4. PITR Supabase : [ACTION HUMAINE] vérifier rétention projet GWA-DATABASE

## Incidents paiement

GeniusPay indisponible → UI `payment=unavailable` (pas de retry API forcé ici).
Ops manuel payout vendeur après confirm (pas d’appel payout API GeniusPay dans ce parcours).
