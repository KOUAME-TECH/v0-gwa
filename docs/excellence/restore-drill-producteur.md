# Dry-run restore — Producteur (tabletop)

**Date** : 2026-11-02 · Agent excellence parcours

## Scénario

Perte partielle table `products` + objets Storage vendeur.

## Étapes (simulées, non exécutées en prod)

1. Identifier dernier backup Supabase PITR [ACTION HUMAINE].
2. Restore table `products` filtrée `seller_id = <uid>` en staging.
3. Réhydrater Storage `products/{uid}/` depuis backup bucket.
4. Vérifier RLS SELECT owner voit ses inactive/archived.
5. Flush `publish-queue` IndexedDB client si annonces perdues post-crash.
6. Recalcul wallet : livré/released − withdrawal_requests.

## Résultat dry-run

Procédure documentée — **pas** d’exercice physique staging dans cette session.  
[ACTION HUMAINE REQUISE] Horodater un restore staging.
