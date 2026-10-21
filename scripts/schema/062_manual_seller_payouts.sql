-- 062 — Producer-visible sales proceeds and audited manual payout operations.
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_reference TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.profiles(id);

CREATE TABLE IF NOT EXISTS public.withdrawal_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id UUID NOT NULL
    REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL CHECK (action IN ('requested', 'processing', 'paid', 'failed')),
  old_status TEXT,
  new_status TEXT NOT NULL,
  payout_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_events_request_created
  ON public.withdrawal_request_events (withdrawal_request_id, created_at DESC);

ALTER TABLE public.withdrawal_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.withdrawal_request_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.withdrawal_request_events TO service_role;

CREATE OR REPLACE FUNCTION public.get_seller_eligible_proceeds(p_seller_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    COALESCE(
      vendeur_recoit_fcfa,
      GREATEST(0, total_amount - COALESCE(commission_fcfa, 0) - COALESCE(service_fee, 0))
    )
  ), 0)
  FROM public.orders
  WHERE seller_id = p_seller_id
    AND payment_status = 'paid'
    AND status = 'delivered'
    AND escrow_status = 'released'
    AND COALESCE(payout_status, '') NOT IN ('processing', 'paid', 'skipped_sim', 'skipped_zero');
$$;

REVOKE ALL ON FUNCTION public.get_seller_eligible_proceeds(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_manual_payout(
  p_amount_fcfa INTEGER,
  p_phone TEXT,
  p_network TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester UUID := auth.uid();
  requester_type TEXT;
  available_amount NUMERIC := 0;
  reserved_amount NUMERIC := 0;
  request_id UUID;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_amount_fcfa IS NULL OR p_amount_fcfa < 1000 THEN
    RAISE EXCEPTION 'amount below minimum';
  END IF;
  IF p_phone IS NULL
    OR length(p_phone) < 8
    OR length(p_phone) > 25
    OR p_phone !~ '^[+0-9][0-9[:space:]().-]{7,24}$'
  THEN
    RAISE EXCEPTION 'invalid phone';
  END IF;
  IF p_network IS NULL OR p_network NOT IN ('orange_ci', 'mtn_ci', 'moov_ci', 'wave_ci') THEN
    RAISE EXCEPTION 'invalid network';
  END IF;

  -- This row lock serializes payout requests from the same seller.
  SELECT user_type
    INTO requester_type
    FROM public.profiles
    WHERE id = requester
    FOR UPDATE;

  IF requester_type IS NULL
    OR requester_type NOT IN ('producteur', 'cooperative', 'transformateur', 'farmer', 'processor')
  THEN
    RAISE EXCEPTION 'seller role required';
  END IF;

  available_amount := public.get_seller_eligible_proceeds(requester);

  SELECT COALESCE(SUM(amount_fcfa), 0)
    INTO reserved_amount
    FROM public.withdrawal_requests
    WHERE user_id = requester
      AND status IN ('pending', 'processing', 'paid');

  IF p_amount_fcfa > available_amount - reserved_amount THEN
    RAISE EXCEPTION 'insufficient available balance';
  END IF;

  INSERT INTO public.withdrawal_requests (
    user_id, amount_fcfa, phone, network, status
  )
  VALUES (requester, p_amount_fcfa, p_phone, p_network, 'pending')
  RETURNING id INTO request_id;

  INSERT INTO public.withdrawal_request_events (
    withdrawal_request_id, actor_user_id, action, new_status
  )
  VALUES (request_id, requester, 'requested', 'pending');

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_manual_payout(INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_manual_payout(INTEGER, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_seller_earnings_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester UUID := auth.uid();
  result JSONB;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  WITH seller_orders AS (
    SELECT
      status,
      payment_status,
      escrow_status,
      payout_status,
      COALESCE(
        vendeur_recoit_fcfa,
        GREATEST(0, total_amount - COALESCE(commission_fcfa, 0) - COALESCE(service_fee, 0))
      ) AS seller_net
    FROM public.orders
    WHERE seller_id = requester
  ),
  payout_requests AS (
    SELECT
      COALESCE(SUM(amount_fcfa) FILTER (WHERE status IN ('pending', 'processing')), 0) AS reserved,
      COALESCE(SUM(amount_fcfa) FILTER (WHERE status = 'paid'), 0) AS paid
    FROM public.withdrawal_requests
    WHERE user_id = requester
  ),
  seller_proceeds AS (
    SELECT public.get_seller_eligible_proceeds(requester) AS eligible
  )
  SELECT jsonb_build_object(
    'orders_count', (SELECT COUNT(*) FROM seller_orders),
    'paid_orders_count', (SELECT COUNT(*) FROM seller_orders WHERE payment_status = 'paid'),
    'delivered_orders_count', (
      SELECT COUNT(*) FROM seller_orders
      WHERE payment_status = 'paid' AND status = 'delivered'
    ),
    'total_paid_sales', COALESCE((
      SELECT SUM(seller_net) FROM seller_orders WHERE payment_status = 'paid'
    ), 0),
    'sales_in_progress', COALESCE((
      SELECT SUM(seller_net) FROM seller_orders
      WHERE payment_status = 'paid' AND status <> 'delivered'
    ), 0),
    'eligible_proceeds', seller_proceeds.eligible,
    'reserved_for_payout', payout_requests.reserved,
    'paid_out', payout_requests.paid,
    'available_for_request', GREATEST(
      0,
      seller_proceeds.eligible - payout_requests.reserved - payout_requests.paid
    )
  )
  INTO result
  FROM payout_requests CROSS JOIN seller_proceeds;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_seller_earnings_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_earnings_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_manual_payout(
  p_request_id UUID,
  p_new_status TEXT,
  p_payout_reference TEXT,
  p_notes TEXT,
  p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.withdrawal_requests%ROWTYPE;
  updated public.withdrawal_requests%ROWTYPE;
  action_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = p_actor
      AND ar.is_active = true
      AND ar.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'finance admin required';
  END IF;

  IF p_new_status NOT IN ('processing', 'paid', 'failed') THEN
    RAISE EXCEPTION 'invalid payout status';
  END IF;
  IF p_new_status = 'paid' AND length(trim(COALESCE(p_payout_reference, ''))) = 0 THEN
    RAISE EXCEPTION 'payout reference required';
  END IF;
  IF p_new_status = 'paid' AND length(trim(p_payout_reference)) > 128 THEN
    RAISE EXCEPTION 'payout reference too long';
  END IF;

  SELECT *
    INTO existing
    FROM public.withdrawal_requests
    WHERE id = p_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout request not found';
  END IF;
  IF NOT (
    (existing.status = 'pending' AND p_new_status IN ('processing', 'failed'))
    OR (existing.status = 'processing' AND p_new_status IN ('paid', 'failed'))
  ) THEN
    RAISE EXCEPTION 'invalid payout transition';
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_new_status,
      payout_reference = CASE WHEN p_new_status = 'paid' THEN trim(p_payout_reference) ELSE payout_reference END,
      admin_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
      processed_by = p_actor,
      processed_at = CASE WHEN p_new_status IN ('paid', 'failed') THEN NOW() ELSE processed_at END,
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO updated;

  action_name := p_new_status;
  INSERT INTO public.withdrawal_request_events (
    withdrawal_request_id, actor_user_id, action, old_status, new_status,
    payout_reference, notes
  )
  VALUES (
    p_request_id, p_actor, action_name, existing.status, updated.status,
    updated.payout_reference, updated.admin_notes
  );

  RETURN to_jsonb(updated);
END;
$$;

-- Only the finance API calls this with its authenticated admin id; the RPC also rechecks admin_roles.
REVOKE ALL ON FUNCTION public.admin_update_manual_payout(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_manual_payout(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
