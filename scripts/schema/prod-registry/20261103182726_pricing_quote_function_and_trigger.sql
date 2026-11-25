-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261103182726 · nom « pricing_quote_function_and_trigger » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE OR REPLACE FUNCTION public.gwa_quote_pricing(p_seller_id UUID, p_product_price NUMERIC, p_plan_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.pricing_plans%ROWTYPE;
  v_user_type TEXT;
  v_assigned UUID;
  v_default_name TEXT;
  v_price NUMERIC;
  v_commission NUMERIC;
  v_buyer NUMERIC;
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
      v_default_name := CASE WHEN v_user_type = 'cooperative' THEN 'COOP_START' ELSE 'FREE' END;
      SELECT * INTO v_plan FROM public.pricing_plans WHERE name = v_default_name;
      v_found := FOUND;
    END IF;
  END IF;
  IF NOT v_found THEN
    RAISE EXCEPTION 'pricing_plan_missing';
  END IF;
  v_price := ROUND(GREATEST(COALESCE(p_product_price, 0), 0));
  IF v_plan.franchise_threshold > 0 AND v_plan.franchise_cap > 0 AND v_price > v_plan.franchise_threshold THEN
    v_commission := v_plan.franchise_cap;
    v_franchise := TRUE;
  ELSE
    v_commission := ROUND(v_price * v_plan.commission_rate);
  END IF;
  v_buyer := ROUND(COALESCE(v_plan.buyer_service_fee_fixed, 0) + v_price * COALESCE(v_plan.buyer_service_fee_rate, 0));
  RETURN jsonb_build_object(
    'pricing_plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'target', v_plan.target,
    'product_price', v_price,
    'commission_rate_applied', v_plan.commission_rate,
    'seller_commission', v_commission,
    'franchise_applied', v_franchise,
    'buyer_service_fee', v_buyer,
    'seller_net_amount', v_price - v_commission,
    'total_amount', v_price + v_buyer
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gwa_quote_pricing(UUID, NUMERIC, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gwa_quote_pricing(UUID, NUMERIC, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_quote_pricing(UUID, NUMERIC, UUID) TO service_role;
CREATE OR REPLACE FUNCTION public.orders_apply_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q JSONB;
  shipping NUMERIC;
BEGIN
  q := public.gwa_quote_pricing(NEW.seller_id, COALESCE(NEW.subtotal, NEW.product_price, 0), NULL);
  shipping := COALESCE(NEW.shipping_cost, 0);
  NEW.product_price := (q->>'product_price')::NUMERIC;
  NEW.buyer_service_fee := (q->>'buyer_service_fee')::NUMERIC;
  NEW.service_fee := NEW.buyer_service_fee;
  NEW.seller_commission := (q->>'seller_commission')::INTEGER;
  NEW.commission_fcfa := NEW.seller_commission;
  NEW.commission_rate_applied := (q->>'commission_rate_applied')::NUMERIC;
  NEW.commission_pct := ROUND(NEW.commission_rate_applied * 100, 2);
  NEW.seller_net_amount := (q->>'seller_net_amount')::INTEGER;
  NEW.vendeur_recoit_fcfa := NEW.seller_net_amount;
  NEW.pricing_plan_id := (q->>'pricing_plan_id')::UUID;
  NEW.total_amount := NEW.product_price + NEW.buyer_service_fee + shipping;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_apply_pricing ON public.orders;
CREATE TRIGGER trg_orders_apply_pricing BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_apply_pricing();
REVOKE ALL ON FUNCTION public.orders_apply_pricing() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orders_apply_pricing() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_apply_pricing() TO service_role;
