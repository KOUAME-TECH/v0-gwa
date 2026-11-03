-- 067 — Grilles tarifaires GWA (producteurs et coopératives).
-- Taux, franchises et frais acheteur vivent dans pricing_plans.
-- Un trigger recalcule la commission à l'insertion d'une commande.

CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  target TEXT NOT NULL CHECK (target IN ('producer', 'cooperative')),
  monthly_fee INTEGER NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  commission_rate NUMERIC(8, 4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  buyer_service_fee_fixed INTEGER NOT NULL DEFAULT 0 CHECK (buyer_service_fee_fixed >= 0),
  buyer_service_fee_rate NUMERIC(8, 4) NOT NULL DEFAULT 0 CHECK (
    buyer_service_fee_rate >= 0 AND buyer_service_fee_rate <= 1
  ),
  franchise_threshold INTEGER NOT NULL DEFAULT 0 CHECK (franchise_threshold >= 0),
  franchise_cap INTEGER NOT NULL DEFAULT 0 CHECK (franchise_cap >= 0),
  switch_threshold INTEGER CHECK (switch_threshold IS NULL OR switch_threshold >= 0),
  next_plan_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pricing_plans
  DROP CONSTRAINT IF EXISTS pricing_plans_next_plan_fk;
ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_next_plan_fk
  FOREIGN KEY (next_plan_id) REFERENCES public.pricing_plans (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  aggregator_rate NUMERIC(8, 4) NOT NULL DEFAULT 0.03 CHECK (aggregator_rate >= 0 AND aggregator_rate <= 1),
  aggregator_fixed INTEGER NOT NULL DEFAULT 50 CHECK (aggregator_fixed >= 0),
  margin_alert_fcfa INTEGER NOT NULL DEFAULT 2000 CHECK (margin_alert_fcfa >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pricing_plan_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.pricing_plans (id) ON DELETE SET NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pricing_switch_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.pricing_plans (id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (seller_id, plan_id, period)
);

INSERT INTO public.pricing_plans (
  name, target, monthly_fee, commission_rate,
  buyer_service_fee_fixed, buyer_service_fee_rate,
  franchise_threshold, franchise_cap, switch_threshold, is_active
)
VALUES
  ('FREE', 'producer', 0, 0.08, 0, 0, 100000, 8000, 250000, TRUE),
  ('STARTER', 'producer', 2500, 0.07, 0, 0, 200000, 12000, 500000, TRUE),
  ('PRO', 'producer', 7500, 0.06, 0, 0, 500000, 18000, NULL, TRUE),
  ('COOP_START', 'cooperative', 5000, 0.06, 0, 0, 300000, 12000, 1000000, TRUE),
  ('COOP_PRO', 'cooperative', 15000, 0.05, 0, 0, 1000000, 32000, NULL, TRUE),
  ('COOP_ENTERPRISE', 'cooperative', 0, 0.04, 0, 0, 0, 0, NULL, TRUE)
ON CONFLICT (name) DO NOTHING;

UPDATE public.pricing_plans AS current
SET next_plan_id = next_plan.id
FROM public.pricing_plans AS next_plan
WHERE (current.name, next_plan.name) IN (
  ('FREE', 'STARTER'),
  ('STARTER', 'PRO'),
  ('COOP_START', 'COOP_PRO')
);

INSERT INTO public.pricing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pricing_plan_id UUID REFERENCES public.pricing_plans (id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_price NUMERIC,
  ADD COLUMN IF NOT EXISTS buyer_service_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_commission INTEGER,
  ADD COLUMN IF NOT EXISTS seller_net_amount INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_plan_id UUID REFERENCES public.pricing_plans (id),
  ADD COLUMN IF NOT EXISTS commission_rate_applied NUMERIC;

UPDATE public.profiles AS profile
SET pricing_plan_id = plan.id
FROM public.pricing_plans AS plan
WHERE profile.pricing_plan_id IS NULL
  AND plan.name = CASE
    WHEN profile.user_type = 'cooperative' AND profile.subscription_tier IN ('pro', 'premium', 'plus')
      THEN 'COOP_PRO'
    WHEN profile.user_type = 'cooperative'
      AND profile.subscription_tier IN ('enterprise', 'entreprise', 'business', 'biz')
      THEN 'COOP_ENTERPRISE'
    WHEN profile.user_type = 'cooperative' THEN 'COOP_START'
    WHEN profile.user_type IN ('producteur', 'farmer', 'processor', 'transformateur', 'artisan')
      AND profile.subscription_tier IN ('starter', 'essentiel', 'start') THEN 'STARTER'
    WHEN profile.user_type IN ('producteur', 'farmer', 'processor', 'transformateur', 'artisan')
      AND profile.subscription_tier IN ('pro', 'premium', 'plus', 'enterprise', 'entreprise', 'business', 'biz')
      THEN 'PRO'
    WHEN profile.user_type IN ('producteur', 'farmer', 'processor', 'transformateur', 'artisan')
      THEN 'FREE'
    ELSE NULL
  END;

CREATE OR REPLACE FUNCTION public.gwa_quote_pricing(
  p_seller_id UUID,
  p_product_price NUMERIC,
  p_plan_id UUID DEFAULT NULL
)
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
    SELECT user_type, pricing_plan_id
      INTO v_user_type, v_assigned
    FROM public.profiles
    WHERE id = p_seller_id;

    IF v_assigned IS NOT NULL THEN
      SELECT * INTO v_plan FROM public.pricing_plans WHERE id = v_assigned;
      v_found := FOUND AND v_plan.is_active IS TRUE;
    END IF;

    IF NOT v_found THEN
      v_default_name := CASE
        WHEN v_user_type = 'cooperative' THEN 'COOP_START'
        ELSE 'FREE'
      END;
      SELECT * INTO v_plan FROM public.pricing_plans WHERE name = v_default_name;
      v_found := FOUND;
    END IF;
  END IF;

  IF NOT v_found THEN
    RAISE EXCEPTION 'pricing_plan_missing';
  END IF;

  v_price := ROUND(GREATEST(COALESCE(p_product_price, 0), 0));
  IF v_plan.franchise_threshold > 0
     AND v_plan.franchise_cap > 0
     AND v_price > v_plan.franchise_threshold THEN
    v_commission := v_plan.franchise_cap;
    v_franchise := TRUE;
  ELSE
    v_commission := ROUND(v_price * v_plan.commission_rate);
  END IF;

  v_buyer := ROUND(
    COALESCE(v_plan.buyer_service_fee_fixed, 0)
    + v_price * COALESCE(v_plan.buyer_service_fee_rate, 0)
  );

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
CREATE TRIGGER trg_orders_apply_pricing
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_apply_pricing();

REVOKE ALL ON FUNCTION public.orders_apply_pricing() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.orders_apply_pricing() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.orders_apply_pricing() TO service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
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

  NEW.is_verified := OLD.is_verified;
  NEW.is_suspended := OLD.is_suspended;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_by := OLD.suspended_by;
  NEW.scg_score := OLD.scg_score;
  NEW.scg_badge := OLD.scg_badge;
  NEW.scg_bancable := OLD.scg_bancable;
  NEW.scg_calculated_at := OLD.scg_calculated_at;
  NEW.scg_criteria := OLD.scg_criteria;
  NEW.rccm_verified := OLD.rccm_verified;
  NEW.subscription_tier := OLD.subscription_tier;
  NEW.pricing_plan_id := OLD.pricing_plan_id;
  NEW.rating := OLD.rating;
  NEW.total_reviews := OLD.total_reviews;
  NEW.phone := OLD.phone;
  NEW.phone_verified := OLD.phone_verified;
  NEW.user_type := OLD.user_type;
  NEW.sub_type := OLD.sub_type;
  NEW.coop_id := OLD.coop_id;
  RETURN NEW;
END;
$$;

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_plan_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_switch_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_plans_select_active ON public.pricing_plans;
CREATE POLICY pricing_plans_select_active
  ON public.pricing_plans
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS pricing_settings_no_client ON public.pricing_settings;
CREATE POLICY pricing_settings_no_client
  ON public.pricing_settings
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS pricing_audit_no_client ON public.pricing_plan_audit;
CREATE POLICY pricing_audit_no_client
  ON public.pricing_plan_audit
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS pricing_switch_select_own ON public.pricing_switch_notices;
CREATE POLICY pricing_switch_select_own
  ON public.pricing_switch_notices
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

COMMENT ON TABLE public.pricing_plans IS
  'Grille GWA configurable. FREE/STARTER/PRO producteurs, COOP_* coopératives. Franchise 0 = pas de plafond.';
COMMENT ON FUNCTION public.gwa_quote_pricing IS
  'Calcule commission vendeur, frais acheteur et net. Seuil franchise strictement dépassé → plafond.';
