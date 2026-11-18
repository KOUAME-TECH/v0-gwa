-- Purge des commandes non payées.
-- Exclusion absolue : GWA-MW16COUJ (payment_status = paid).
-- Les tables filles en CASCADE (lignes, séquestre, facture, audit, historique, litiges)
-- suivent la commande. Un message ou un avis qui bloquerait la suppression arrête le script.

BEGIN;

DO $$
DECLARE
  v_paid int;
  v_target int;
BEGIN
  SELECT COUNT(*) INTO v_paid
  FROM public.orders
  WHERE order_number = 'GWA-MW16COUJ'
    AND payment_status = 'paid';

  IF v_paid <> 1 THEN
    RAISE EXCEPTION 'GWA-MW16COUJ introuvable ou plus payée. Purge annulée.';
  END IF;

  SELECT COUNT(*) INTO v_target
  FROM public.orders
  WHERE payment_status IS DISTINCT FROM 'paid'
    AND order_number IS DISTINCT FROM 'GWA-MW16COUJ';

  IF EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.orders o ON o.id = m.order_ref_id
    WHERE o.payment_status IS DISTINCT FROM 'paid'
      AND o.order_number IS DISTINCT FROM 'GWA-MW16COUJ'
  ) THEN
    RAISE EXCEPTION 'Des messages référencent une commande non payée. Purge annulée.';
  END IF;

  DELETE FROM public.orders
  WHERE payment_status IS DISTINCT FROM 'paid'
    AND order_number IS DISTINCT FROM 'GWA-MW16COUJ';

  IF NOT EXISTS (
    SELECT 1 FROM public.orders WHERE order_number = 'GWA-MW16COUJ' AND payment_status = 'paid'
  ) THEN
    RAISE EXCEPTION 'La commande payée a disparu. Purge annulée.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE payment_status IS DISTINCT FROM 'paid'
       OR order_number IS DISTINCT FROM 'GWA-MW16COUJ'
  ) THEN
    RAISE EXCEPTION 'Il reste une commande autre que GWA-MW16COUJ. Purge annulée.';
  END IF;

  RAISE NOTICE 'Commandes non payées supprimées : %', v_target;
END $$;

COMMIT;
