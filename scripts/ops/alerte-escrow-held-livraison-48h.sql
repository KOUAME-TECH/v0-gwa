-- Contrôle Finance 8f (lecture seule) : commande payée, séquestre held, délai de livraison dépassé de plus de 48 h.
-- Délai = orders.delivery_deadline ; à défaut orders.estimated_delivery (date, fin de journée UTC) ;
-- à défaut APPROXIMATION created_at + 7 jours (colonne source_delai = 'approx_created_at_7j').
-- Attendu : 0 ligne.
SELECT id, order_number, seller_id, status, total_amount,
       coalesce(delivery_deadline, (estimated_delivery + 1)::timestamptz, created_at + interval '7 days') AS delai,
       CASE WHEN delivery_deadline IS NOT NULL THEN 'delivery_deadline'
            WHEN estimated_delivery IS NOT NULL THEN 'estimated_delivery'
            ELSE 'approx_created_at_7j' END AS source_delai
FROM public.orders
WHERE payment_status = 'paid'
  AND escrow_status = 'held'
  AND coalesce(delivery_deadline, (estimated_delivery + 1)::timestamptz, created_at + interval '7 days') < now() - interval '48 hours'
ORDER BY delai;
