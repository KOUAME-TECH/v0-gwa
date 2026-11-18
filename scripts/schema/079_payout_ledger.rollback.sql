-- Rollback 079 : retire le livre de versement et rétablit gwa_payout_fee (074)
-- et admin_update_manual_payout (065). À n'exécuter que s'il n'existe plus
-- de lignes financial_ledger dont transaction_id n'est pas un orders.id,
-- sinon la FK vers orders ne peut pas être recréée.

DROP INDEX IF EXISTS public.financial_ledger_payout_leg_uidx;

-- Recrée la FK seulement si tous les transaction_id existent dans orders.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.financial_ledger l
    LEFT JOIN public.orders o ON o.id = l.transaction_id
    WHERE o.id IS NULL
  ) THEN
    BEGIN
      ALTER TABLE public.financial_ledger
        ADD CONSTRAINT financial_ledger_transaction_id_fkey
        FOREIGN KEY (transaction_id) REFERENCES public.orders (id) ON DELETE RESTRICT;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  ELSE
    RAISE NOTICE '079 rollback : FK non recréée, des transaction_id ne sont pas des commandes';
  END IF;
END $$;

ALTER TABLE public.withdrawal_requests
  DROP COLUMN IF EXISTS processing_by;

DROP FUNCTION IF EXISTS public.gwa_payout_fee(uuid, uuid);

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

