-- 054 — Normalize payment provider references after GeniusPay migration
-- Safe to run repeatedly on existing installations.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reference text;

UPDATE public.orders
SET payment_reference = feexpay_ref
WHERE payment_reference IS NULL AND feexpay_ref IS NOT NULL;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS feexpay_ref;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payment_reference text;

UPDATE public.withdrawal_requests
SET payment_reference = feexpay_ref
WHERE payment_reference IS NULL AND feexpay_ref IS NOT NULL;

ALTER TABLE public.withdrawal_requests
  DROP COLUMN IF EXISTS feexpay_ref;

CREATE INDEX IF NOT EXISTS idx_orders_payment_reference
  ON public.orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_payment_reference
  ON public.withdrawal_requests (payment_reference)
  WHERE payment_reference IS NOT NULL;

ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS payment_reference text;

UPDATE public.escrow_transactions
SET payment_reference = feexpay_ref
WHERE payment_reference IS NULL AND feexpay_ref IS NOT NULL;

ALTER TABLE public.escrow_transactions
  DROP COLUMN IF EXISTS feexpay_ref;
