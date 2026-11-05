-- Vision 100 du 5 novembre.
-- Les lignes pricing_plans restent (mêmes id). Le code stable (FREE, STARTER…)
-- ne change pas. Le nom public et les taux changent.
-- Les commandes déjà insérées ne sont pas recalculées.

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS code text;

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS payout_included integer NOT NULL DEFAULT 0;

UPDATE public.pricing_plans
SET code = name
WHERE code IS NULL
  AND name IN ('FREE', 'STARTER', 'PRO', 'COOP_START', 'COOP_PRO', 'COOP_ENTERPRISE');

CREATE UNIQUE INDEX IF NOT EXISTS pricing_plans_code_uidx
  ON public.pricing_plans (code)
  WHERE code IS NOT NULL;

UPDATE public.pricing_plans SET
  name = 'Graine',
  monthly_fee = 0,
  commission_rate = 0.09,
  franchise_threshold = 133000,
  franchise_cap = 12000,
  payout_included = 0,
  updated_at = NOW()
WHERE code = 'FREE';

UPDATE public.pricing_plans SET
  name = 'Pousse',
  monthly_fee = 3000,
  commission_rate = 0.08,
  franchise_threshold = 312000,
  franchise_cap = 25000,
  payout_included = 3,
  updated_at = NOW()
WHERE code = 'STARTER';

UPDATE public.pricing_plans SET
  name = 'Récolte',
  monthly_fee = 8000,
  commission_rate = 0.07,
  franchise_threshold = 642000,
  franchise_cap = 45000,
  payout_included = 99,
  updated_at = NOW()
WHERE code = 'PRO';

UPDATE public.pricing_plans SET
  name = 'Coopérative',
  monthly_fee = 8000,
  commission_rate = 0.07,
  franchise_threshold = 500000,
  franchise_cap = 35000,
  payout_included = 5,
  updated_at = NOW()
WHERE code = 'COOP_START';

UPDATE public.pricing_plans SET
  name = 'Union',
  monthly_fee = 20000,
  commission_rate = 0.06,
  franchise_threshold = 1000000,
  franchise_cap = 60000,
  payout_included = 99,
  updated_at = NOW()
WHERE code = 'COOP_PRO';

UPDATE public.pricing_plans SET
  name = 'Fédération',
  monthly_fee = 0,
  commission_rate = 0.05,
  franchise_threshold = 0,
  franchise_cap = 0,
  payout_included = 99,
  updated_at = NOW()
WHERE code = 'COOP_ENTERPRISE';

INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('buyer_service_fee_fixed', '250'::jsonb, 'Frais fixe payé par l’acheteur, en FCFA'),
  ('payout_fee_cost', '300'::jsonb, 'Frais de versement au-delà du quota inclus, en FCFA'),
  ('tax_rate', '0'::jsonb, 'Taux de taxe, en fraction')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.country_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  currency varchar(3) NOT NULL DEFAULT 'XOF',
  payment_provider text NOT NULL DEFAULT 'geniuspay',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO public.country_configs (country_code, currency, payment_provider, is_active)
VALUES ('CI', 'XOF', 'geniuspay', true)
ON CONFLICT (country_code) DO NOTHING;

GRANT SELECT ON public.country_configs TO anon, authenticated;
ALTER TABLE public.country_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS country_configs_read_active ON public.country_configs;
CREATE POLICY country_configs_read_active
  ON public.country_configs
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.admin_roles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%super_admin%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.admin_roles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.admin_roles
  DROP CONSTRAINT IF EXISTS admin_roles_role_check;
ALTER TABLE public.admin_roles
  ADD CONSTRAINT admin_roles_role_check
  CHECK (role IN ('super_admin', 'admin', 'finance_admin', 'moderator', 'support'));

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
    SELECT user_type, pricing_plan_id
      INTO v_user_type, v_assigned
    FROM public.profiles
    WHERE id = p_seller_id;

    IF v_assigned IS NOT NULL THEN
      SELECT * INTO v_plan FROM public.pricing_plans WHERE id = v_assigned;
      v_found := FOUND AND v_plan.is_active IS TRUE;
    END IF;

    IF NOT v_found THEN
      v_default_code := CASE
        WHEN v_user_type = 'cooperative' THEN 'COOP_START'
        ELSE 'FREE'
      END;
      SELECT * INTO v_plan
      FROM public.pricing_plans
      WHERE code = v_default_code OR name = v_default_code
      ORDER BY (code = v_default_code) DESC
      LIMIT 1;
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

  SELECT CASE
    WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::integer
    WHEN jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[0-9]+$' THEN (value #>> '{}')::integer
    ELSE NULL
  END
  INTO v_buyer_fixed
  FROM public.platform_settings
  WHERE key = 'buyer_service_fee_fixed';

  v_buyer := ROUND(
    COALESCE(v_buyer_fixed, v_plan.buyer_service_fee_fixed, 0)
    + v_price * COALESCE(v_plan.buyer_service_fee_rate, 0)
  );

  RETURN jsonb_build_object(
    'pricing_plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'plan_code', v_plan.code,
    'target', v_plan.target,
    'product_price', v_price,
    'commission_rate_applied', v_plan.commission_rate,
    'seller_commission', v_commission,
    'franchise_applied', v_franchise,
    'buyer_service_fee', v_buyer,
    'seller_net_amount', v_price - v_commission,
    'total_amount', v_price + v_buyer,
    'payout_included', v_plan.payout_included
  );
END;
$$;
