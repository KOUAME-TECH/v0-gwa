-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261105103129 · nom « vision100_pricing_quote_fn » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint WHERE conrelid = 'public.admin_roles'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%super_admin%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.admin_roles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
ALTER TABLE public.admin_roles DROP CONSTRAINT IF EXISTS admin_roles_role_check;
ALTER TABLE public.admin_roles ADD CONSTRAINT admin_roles_role_check CHECK (role IN ('super_admin', 'admin', 'finance_admin', 'moderator', 'support'));
CREATE OR REPLACE FUNCTION public.gwa_quote_pricing(p_seller_id UUID, p_product_price NUMERIC, p_plan_id UUID DEFAULT NULL) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_plan public.pricing_plans%ROWTYPE;
  v_user_type TEXT;
  v_assigned UUID;
  v_default_code TEXT;
  v_price NUMERIC;
  v_commission NUMERIC;
  v_buyer NUMERIC;
  v_buyer_fixed INTEGER;
  v_franchise BOOLEAN := FALSE;
  v_found BOOLEAN := FALSE;
BEGIN
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.pricing_plans WHERE id = p_plan_id;
    v_found := FOUND;
  ELSE
    SELECT user_type, pricing_plan_id INTO v_user_type, v_assigned FROM public.profiles WHERE id = p_seller_id;
    IF v_assigned IS NOT NULL THEN
      SELECT * INTO v_plan FROM public.pricing_plans WHERE id = v_assigned;
      v_found := FOUND AND v_plan.is_active IS TRUE;
    END IF;
    IF NOT v_found THEN
      v_default_code := CASE WHEN v_user_type = 'cooperative' THEN 'COOP_START' ELSE 'FREE' END;
      SELECT * INTO v_plan FROM public.pricing_plans WHERE code = v_default_code OR name = v_default_code ORDER BY (code = v_default_code) DESC LIMIT 1;
      v_found := FOUND;
    END IF;
  END IF;
  IF NOT v_found THEN RAISE EXCEPTION 'pricing_plan_missing'; END IF;
  v_price := ROUND(GREATEST(COALESCE(p_product_price, 0), 0));
  IF v_plan.franchise_threshold > 0 AND v_plan.franchise_cap > 0 AND v_price > v_plan.franchise_threshold THEN
    v_commission := v_plan.franchise_cap;
    v_franchise := TRUE;
  ELSE
    v_commission := ROUND(v_price * v_plan.commission_rate);
  END IF;
  SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::integer WHEN jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[0-9]+$' THEN (value #>> '{}')::integer ELSE NULL END INTO v_buyer_fixed FROM public.platform_settings WHERE key = 'buyer_service_fee_fixed';
  v_buyer := ROUND(COALESCE(v_buyer_fixed, v_plan.buyer_service_fee_fixed, 0) + v_price * COALESCE(v_plan.buyer_service_fee_rate, 0));
  RETURN jsonb_build_object('pricing_plan_id', v_plan.id, 'plan_name', v_plan.name, 'plan_code', v_plan.code, 'target', v_plan.target, 'product_price', v_price, 'commission_rate_applied', v_plan.commission_rate, 'seller_commission', v_commission, 'franchise_applied', v_franchise, 'buyer_service_fee', v_buyer, 'seller_net_amount', v_price - v_commission, 'total_amount', v_price + v_buyer, 'payout_included', v_plan.payout_included);
END;
$fn$;
