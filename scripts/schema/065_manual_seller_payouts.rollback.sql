-- ROLLBACK 065 — LOCAL / staging only. Ne jamais exécuter en prod sans GO explicite.
-- Ordre inverse des créations de 065_manual_seller_payouts.sql

DROP FUNCTION IF EXISTS public.admin_update_manual_payout(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_seller_earnings_summary();
DROP FUNCTION IF EXISTS public.request_manual_payout(INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_seller_eligible_proceeds(UUID);
DROP FUNCTION IF EXISTS public.gwa_payout_eligible_orders(UUID);

DROP TABLE IF EXISTS public.withdrawal_request_events;

ALTER TABLE public.withdrawal_requests
  DROP COLUMN IF EXISTS payout_reference,
  DROP COLUMN IF EXISTS admin_notes,
  DROP COLUMN IF EXISTS processed_by;

-- Restaure le trigger protecteur à l'état antérieur uniquement si une version
-- pré-065 est versionnée ailleurs ; ici on retire le trigger 065.
DROP TRIGGER IF EXISTS trg_protect_order_privileged ON public.orders;
DROP FUNCTION IF EXISTS public.protect_order_privileged_columns();

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_currency_format_check;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS provider_reference;

-- currency peut déjà exister via 058 — ne pas dropper automatiquement.
-- ALTER TABLE public.orders DROP COLUMN IF EXISTS currency;
