-- Frais de versement, prévente et lecture des demandes ouvertes.
-- Idempotent : les fonctions déjà présentes sont remplacées.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payout_fee_fcfa integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_mode text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_fulfillment_mode_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_mode_check
  CHECK (fulfillment_mode IS NULL OR fulfillment_mode IN ('stock', 'preorder'));

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS stock_taken integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preorder_taken integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (status IN (
    'draft', 'pending', 'paid', 'paid_preorder', 'confirmed', 'processing', 'shipped',
    'delivered', 'completed', 'cancelled', 'disputed'
  ));

CREATE OR REPLACE FUNCTION public.gwa_payout_fee(p_seller_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_included integer := 0;
  v_fee integer := 0;
  v_count integer := 0;
  v_plan_id uuid;
  v_user_type text;
BEGIN
  SELECT pricing_plan_id, user_type
    INTO v_plan_id, v_user_type
  FROM public.profiles
  WHERE id = p_seller_id;

  IF v_plan_id IS NOT NULL THEN
    SELECT COALESCE(payout_included, 0) INTO v_included
    FROM public.pricing_plans WHERE id = v_plan_id AND is_active IS TRUE;
  END IF;

  IF v_plan_id IS NULL OR v_included IS NULL THEN
    SELECT COALESCE(payout_included, 0) INTO v_included
    FROM public.pricing_plans
    WHERE code = CASE WHEN v_user_type = 'cooperative' THEN 'COOP_START' ELSE 'FREE' END
    LIMIT 1;
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::integer
    WHEN jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[0-9]+$' THEN (value #>> '{}')::integer
    ELSE 0
  END
  INTO v_fee
  FROM public.platform_settings
  WHERE key = 'payout_fee_cost';

  SELECT COUNT(*)::integer INTO v_count
  FROM public.orders
  WHERE seller_id = p_seller_id
    AND confirmed_by_buyer_at >= date_trunc('month', NOW())
    AND confirmed_by_buyer_at < date_trunc('month', NOW()) + INTERVAL '1 month';

  IF COALESCE(v_count, 0) >= COALESCE(v_included, 0) THEN
    RETURN GREATEST(COALESCE(v_fee, 0), 0);
  END IF;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.gwa_payout_fee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gwa_payout_fee(uuid) TO service_role;

DROP POLICY IF EXISTS buyer_requests_select_open ON public.buyer_requests;
CREATE POLICY buyer_requests_select_open
  ON public.buyer_requests
  FOR SELECT
  TO authenticated
  USING (
    status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.user_type IN ('producteur', 'farmer', 'cooperative')
    )
  );
