-- ROLLBACK 076 — ne pas exécuter en production sans revue.
-- Recréer l'index unique échoue s'il existe déjà deux lignes de même paire
-- (libération, extourne, nouvelle libération).

DROP TRIGGER IF EXISTS trg_z_orders_freeze_payout_fee ON public.orders;
DROP FUNCTION IF EXISTS public.orders_freeze_payout_fee();

DROP FUNCTION IF EXISTS public.gwa_post_release_split(uuid, integer, integer, integer, integer, text);
DROP FUNCTION IF EXISTS public.gwa_post_release_split(uuid, integer, integer, integer, integer, text, text, text, text, timestamptz, text, timestamptz);

CREATE OR REPLACE FUNCTION public.protect_order_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    auth.role()
  );
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.payment_status := OLD.payment_status;
  NEW.escrow_status := OLD.escrow_status;
  NEW.payout_status := OLD.payout_status;
  NEW.payout_ref := OLD.payout_ref;
  NEW.payout_at := OLD.payout_at;
  NEW.payout_error := OLD.payout_error;
  NEW.total_amount := OLD.total_amount;
  NEW.subtotal := OLD.subtotal;
  NEW.shipping_cost := OLD.shipping_cost;
  NEW.service_fee := OLD.service_fee;
  NEW.commission_pct := OLD.commission_pct;
  NEW.commission_fcfa := OLD.commission_fcfa;
  NEW.vendeur_recoit_fcfa := OLD.vendeur_recoit_fcfa;
  NEW.buyer_id := OLD.buyer_id;
  NEW.seller_id := OLD.seller_id;
  NEW.product_price := OLD.product_price;
  NEW.buyer_service_fee := OLD.buyer_service_fee;
  NEW.seller_commission := OLD.seller_commission;
  NEW.seller_net_amount := OLD.seller_net_amount;
  NEW.pricing_plan_id := OLD.pricing_plan_id;
  NEW.commission_rate_applied := OLD.commission_rate_applied;
  NEW.lifecycle_status := OLD.lifecycle_status;
  NEW.currency := OLD.currency;

  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payout_fee_frozen_fcfa_nonneg;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS payout_plan_id_at_payment,
  DROP COLUMN IF EXISTS payout_fee_frozen_fcfa;

ALTER TABLE public.financial_ledger
  ALTER COLUMN transaction_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financial_ledger_pair_uidx
  ON public.financial_ledger (transaction_id, account_debit, account_credit);

CREATE OR REPLACE FUNCTION public.gwa_record_ledger_entry(
  p_transaction_id uuid,
  p_debit text,
  p_credit text,
  p_amount integer,
  p_currency text DEFAULT 'XOF'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'montant invalide';
  END IF;
  INSERT INTO public.financial_ledger (
    transaction_id, account_debit, account_credit, amount, currency
  ) VALUES (
    p_transaction_id, p_debit, p_credit, p_amount, COALESCE(NULLIF(p_currency, ''), 'XOF')
  )
  ON CONFLICT (transaction_id, account_debit, account_credit) DO NOTHING
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
