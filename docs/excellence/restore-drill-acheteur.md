# Restore dry-run — Acheteur

**Date** : 2026-11-02 · Branche `gwa/excellence-parcours-1e99`

1. Tables critiques : `orders`, `order_items`, `cart_items`, `favorites`, `escrow_transactions`
2. Vérifier PITR / backups projet `GWA-DATABASE` (frorfexbcyfbydkiwxqv) — [ACTION HUMAINE]
3. Scénario perte guest cart : clear `localStorage.gwa_guest_cart_v1` → panier vide (attendu)
4. Scénario restore DB staging : buyer ne voit que `buyer_id = auth.uid()` (RLS)
5. Aucun appel GeniusPay payout dans ce drill

**Statut** : dry-run documenté — restore physique staging = humain.
