-- Contrôle Finance (lecture seule) : commandes livrées, séquestre libéré, payout_status NULL depuis plus de 24 h.
-- Attendu : 0 ligne. Toute ligne = commande libérée hors de la file de versement (065 liste blanche).
SELECT id, order_number, seller_id, total_amount, vendeur_recoit_fcfa,
       coalesce(confirmed_by_buyer_at, delivered_at, updated_at) AS libere_depuis
FROM public.orders
WHERE status = 'delivered'
  AND escrow_status = 'released'
  AND payout_status IS NULL
  AND payment_status = 'paid'
  AND coalesce(confirmed_by_buyer_at, delivered_at, updated_at) < now() - interval '24 hours'
ORDER BY libere_depuis;
