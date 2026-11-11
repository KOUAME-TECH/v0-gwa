-- 076 — Libération atomique du séquestre, frais de versement figé au paiement.
-- Ne recalcule aucune commande déjà payée. Aucun UPDATE de données.
-- Les commandes antérieures, y compris celles d'avant le 5 novembre 2026,
-- restent à payout_fee_frozen_fcfa NULL : la libération automatique doit refuser.

-- Ce que le schéma a déjà, et pourquoi ça ne suffit pas :
--   payout_fee_fcfa integer NOT NULL DEFAULT 0
--     écrit par /confirm en rappelant gwa_payout_fee. 0 = « gratuit » ou « jamais posé ».
--   pricing_plan_id
--     plan au moment de l'INSERT commande (orders_apply_pricing), pas au paiement.
--     Le plan du profil peut changer entre la commande et le paiement.
-- Colonnes ajoutées, toutes les deux NULL, sans valeur par défaut, sans backfill :
--   payout_fee_frozen_fcfa     frais lu par gwa_payout_fee au passage en paid
--   payout_plan_id_at_payment  plan du profil à ce même instant

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payout_fee_frozen_fcfa integer;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payout_fee_frozen_fcfa_nonneg;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payout_fee_frozen_fcfa_nonneg
  CHECK (payout_fee_frozen_fcfa IS NULL OR payout_fee_frozen_fcfa >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payout_plan_id_at_payment uuid REFERENCES public.pricing_plans (id);

COMMENT ON COLUMN public.orders.payout_fee_frozen_fcfa IS
  'Frais de versement figé quand payment_status passe à paid. NULL = non figé : refuser la libération automatique, revue manuelle, ne pas rappeler gwa_payout_fee. Les commandes déjà payées, y compris avant le 5 nov 2026, restent NULL.';

COMMENT ON COLUMN public.orders.payout_plan_id_at_payment IS
  'pricing_plans.id du vendeur au moment où le frais a été figé. NULL si le gel n''a pas eu lieu. Distinct de orders.pricing_plan_id (plan à la création de la commande).';

-- Verrouille les deux colonnes pour tout rôle autre que service_role.
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
  NEW.payout_fee_frozen_fcfa := OLD.payout_fee_frozen_fcfa;
  NEW.payout_plan_id_at_payment := OLD.payout_plan_id_at_payment;

  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

-- Après protect (nom trg_z…) : un UPDATE non service_role a déjà perdu
-- payment_status = paid, donc le gel ne part pas. service_role passe,
-- et le frais n'est écrit que sur la transition réelle vers paid, une fois.
CREATE OR REPLACE FUNCTION public.orders_freeze_payout_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND NEW.payout_fee_frozen_fcfa IS NULL
  THEN
    NEW.payout_fee_frozen_fcfa := public.gwa_payout_fee(NEW.seller_id);
    SELECT p.pricing_plan_id
      INTO NEW.payout_plan_id_at_payment
    FROM public.profiles p
    WHERE p.id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_z_orders_freeze_payout_fee ON public.orders;
CREATE TRIGGER trg_z_orders_freeze_payout_fee
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_freeze_payout_fee();

-- L'index unique (transaction_id, account_debit, account_credit) empêche
-- une seconde libération après extourne : la paire ESCROW → WALLET existe
-- encore. L'idempotence est le solde net, sous verrou, pas cet index.
-- ON CONFLICT de gwa_record_ledger_entry cible cet index : on retire
-- le conflit avant de dropper l'index, sinon l'encaissement casse.
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
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gwa_record_ledger_entry(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_record_ledger_entry(uuid, text, text, integer, text) TO service_role;

DROP INDEX IF EXISTS public.financial_ledger_pair_uidx;

-- hashtext renvoie integer ; le verrou à un argument prend bigint.
CREATE OR REPLACE FUNCTION public.gwa_post_release_split(
  p_transaction_id uuid,
  p_seller_net integer,
  p_commission integer,
  p_buyer_fee integer,
  p_payout_fee integer,
  p_currency text DEFAULT 'XOF'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escrow bigint;
  v_sum bigint;
  v_currency text;
  v_has_payin boolean;
  v_posted boolean;
BEGIN
  IF p_transaction_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pay_in_missing');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_transaction_id::text)::bigint);

  SELECT EXISTS (
    SELECT 1
    FROM public.financial_ledger
    WHERE transaction_id = p_transaction_id
      AND account_debit = 'GATEWAY_GENIUSPAY'
      AND account_credit = 'ESCROW_GWA'
      AND amount > 0
  ) INTO v_has_payin;

  IF NOT COALESCE(v_has_payin, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pay_in_missing');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT account, SUM(delta) AS net
      FROM (
        SELECT account_credit AS account, amount::bigint AS delta
        FROM public.financial_ledger
        WHERE transaction_id = p_transaction_id
        UNION ALL
        SELECT account_debit, -amount::bigint
        FROM public.financial_ledger
        WHERE transaction_id = p_transaction_id
      ) legs
      WHERE account = 'WALLET_SELLER' OR starts_with(account, 'REVENUE_')
      GROUP BY account
    ) nets
    WHERE net > 0
  ) INTO v_posted;

  IF COALESCE(v_posted, false) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_posted');
  END IF;

  IF COALESCE(p_seller_net, 0) < 0
     OR COALESCE(p_commission, 0) < 0
     OR COALESCE(p_buyer_fee, 0) < 0
     OR COALESCE(p_payout_fee, 0) < 0
  THEN
    RETURN jsonb_build_object('ok', false, 'error', 'split_mismatch');
  END IF;

  v_sum := COALESCE(p_seller_net, 0)
         + COALESCE(p_commission, 0)
         + COALESCE(p_buyer_fee, 0)
         + COALESCE(p_payout_fee, 0);

  SELECT COALESCE(SUM(amount) FILTER (WHERE account_credit = 'ESCROW_GWA'), 0)
       - COALESCE(SUM(amount) FILTER (WHERE account_debit = 'ESCROW_GWA'), 0)
    INTO v_escrow
  FROM public.financial_ledger
  WHERE transaction_id = p_transaction_id;

  IF v_sum IS DISTINCT FROM v_escrow THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'split_mismatch',
      'escrow_balance', v_escrow,
      'split_sum', v_sum
    );
  END IF;

  v_currency := COALESCE(NULLIF(p_currency, ''), 'XOF');

  INSERT INTO public.financial_ledger (
    transaction_id, account_debit, account_credit, amount, currency
  )
  SELECT p_transaction_id, v.debit, v.credit, v.amount, v_currency
  FROM (
    VALUES
      ('ESCROW_GWA', 'WALLET_SELLER', COALESCE(p_seller_net, 0)),
      ('ESCROW_GWA', 'REVENUE_GWA', COALESCE(p_commission, 0)),
      ('ESCROW_GWA', 'REVENUE_GWA_BUYER_FEE', COALESCE(p_buyer_fee, 0)),
      ('ESCROW_GWA', 'REVENUE_GWA_PAYOUT', COALESCE(p_payout_fee, 0))
  ) AS v(debit, credit, amount)
  WHERE v.amount > 0;

  RETURN jsonb_build_object('ok', true, 'skipped', false, 'split_sum', v_sum);
END;
$$;

REVOKE ALL ON FUNCTION public.gwa_post_release_split(uuid, integer, integer, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_post_release_split(uuid, integer, integer, integer, integer, text)
  TO service_role;
