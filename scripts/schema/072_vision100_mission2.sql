-- Mission 2 : prévente, grand livre atomique, lecture des demandes ouvertes.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (status IN (
    'draft', 'pending', 'paid', 'paid_preorder', 'confirmed', 'processing', 'shipped',
    'delivered', 'completed', 'cancelled', 'disputed'
  ));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_mode text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_mode_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_mode_check
  CHECK (fulfillment_mode IS NULL OR fulfillment_mode IN ('stock', 'preorder'));

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS stock_taken integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preorder_taken integer NOT NULL DEFAULT 0;

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
  ON CONFLICT (transaction_id, account_debit, account_credit)
  DO NOTHING
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gwa_record_ledger_entry(uuid, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gwa_record_ledger_entry(uuid, text, text, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gwa_reserve_product_stock(
  p_product_id uuid,
  p_qty integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
  v_pre integer;
  v_harvest date;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantité invalide');
  END IF;

  SELECT stock_quantity, COALESCE(preorder_quantity, 0), harvest_date
    INTO v_stock, v_pre, v_harvest
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Produit introuvable');
  END IF;

  IF v_stock IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'mode', 'stock',
      'stock_taken', 0,
      'preorder_taken', 0,
      'harvest_date', v_harvest
    );
  END IF;

  IF p_qty <= v_stock THEN
    UPDATE public.products
      SET stock_quantity = v_stock - p_qty
      WHERE id = p_product_id;
    RETURN jsonb_build_object(
      'ok', true,
      'mode', 'stock',
      'stock_taken', p_qty,
      'preorder_taken', 0,
      'harvest_date', v_harvest
    );
  ELSIF p_qty <= v_stock + v_pre THEN
    UPDATE public.products
      SET stock_quantity = 0,
          preorder_quantity = v_pre - (p_qty - v_stock)
      WHERE id = p_product_id;
    RETURN jsonb_build_object(
      'ok', true,
      'mode', 'preorder',
      'stock_taken', v_stock,
      'preorder_taken', p_qty - v_stock,
      'harvest_date', v_harvest
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Capacité de récolte insuffisante');
END;
$$;

REVOKE ALL ON FUNCTION public.gwa_reserve_product_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gwa_reserve_product_stock(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.gwa_release_product_stock(
  p_product_id uuid,
  p_stock integer,
  p_preorder integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
    SET stock_quantity = CASE
          WHEN stock_quantity IS NULL THEN NULL
          ELSE stock_quantity + GREATEST(COALESCE(p_stock, 0), 0)
        END,
        preorder_quantity = COALESCE(preorder_quantity, 0) + GREATEST(COALESCE(p_preorder, 0), 0)
    WHERE id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gwa_release_product_stock(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gwa_release_product_stock(uuid, integer, integer) TO service_role;

DROP POLICY IF EXISTS buyer_requests_select_open ON public.buyer_requests;
CREATE POLICY buyer_requests_select_open
  ON public.buyer_requests
  FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type IN ('producteur', 'farmer', 'cooperative')
    )
  );
