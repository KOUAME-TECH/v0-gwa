-- 077 — Modules 2 & 3 : intégrité des commandes + grand livre (financial_ledger).
-- À appliquer manuellement après 076. Idempotent.

-- 1. Trigger de protection des colonnes critiques (remplace celui de 068).
--    Hors service_role : aucune colonne financière/paiement/escrow modifiable ;
--    seule transition de statut autorisée : pending -> cancelled (annulation par un participant).
CREATE OR REPLACE FUNCTION public.protect_order_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), auth.role());
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.payment_status := OLD.payment_status;
  NEW.payment_reference := OLD.payment_reference;
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

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending' AND NEW.status = 'cancelled') THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Grand livre : une ligne = un mouvement équilibré (débit = crédit = amount).
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text    NOT NULL,
  debit_account  text    NOT NULL,
  credit_account text    NOT NULL,
  amount         numeric NOT NULL CHECK (amount > 0),
  currency       text    NOT NULL DEFAULT 'XOF',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_ledger_accounts_differ CHECK (debit_account <> credit_account),
  CONSTRAINT financial_ledger_unique_line UNIQUE (transaction_id, debit_account, credit_account, amount)
);
CREATE INDEX IF NOT EXISTS financial_ledger_tx_idx ON public.financial_ledger (transaction_id);

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_ledger FROM PUBLIC, anon, authenticated;
-- Aucune policy pour anon/authenticated : écriture et lecture directes interdites.
GRANT SELECT, INSERT ON public.financial_ledger TO service_role;

CREATE OR REPLACE FUNCTION public.gwa_record_ledger_entry(
  p_transaction_id text,
  p_debit text,
  p_credit text,
  p_amount numeric,
  p_currency text DEFAULT 'XOF'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'ledger amount must be > 0';
  END IF;
  INSERT INTO public.financial_ledger (transaction_id, debit_account, credit_account, amount, currency)
  VALUES (p_transaction_id, p_debit, p_credit, p_amount, coalesce(p_currency, 'XOF'))
  ON CONFLICT (transaction_id, debit_account, credit_account, amount) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.gwa_record_ledger_entry(text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_record_ledger_entry(text, text, text, numeric, text) TO service_role;

-- 3. Stock : gwa_reserve_product_stock doit verrouiller la ligne produit (SELECT ... FOR UPDATE).
--    Sa définition n'est pas versionnée dans ce dépôt : vérifier en production
--    (SELECT prosrc FROM pg_proc WHERE proname='gwa_reserve_product_stock') qu'elle contient FOR UPDATE.
