-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261103182718 · nom « pricing_plans_tables_seed » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  target TEXT NOT NULL CHECK (target IN ('producer', 'cooperative')),
  monthly_fee INTEGER NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  commission_rate NUMERIC(8, 4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 1),
  buyer_service_fee_fixed INTEGER NOT NULL DEFAULT 0 CHECK (buyer_service_fee_fixed >= 0),
  buyer_service_fee_rate NUMERIC(8, 4) NOT NULL DEFAULT 0 CHECK (buyer_service_fee_rate >= 0 AND buyer_service_fee_rate <= 1),
  franchise_threshold INTEGER NOT NULL DEFAULT 0 CHECK (franchise_threshold >= 0),
  franchise_cap INTEGER NOT NULL DEFAULT 0 CHECK (franchise_cap >= 0),
  switch_threshold INTEGER CHECK (switch_threshold IS NULL OR switch_threshold >= 0),
  next_plan_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.pricing_plans DROP CONSTRAINT IF EXISTS pricing_plans_next_plan_fk;
ALTER TABLE public.pricing_plans ADD CONSTRAINT pricing_plans_next_plan_fk FOREIGN KEY (next_plan_id) REFERENCES public.pricing_plans (id) ON DELETE SET NULL;
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
INSERT INTO public.pricing_plans (name, target, monthly_fee, commission_rate, buyer_service_fee_fixed, buyer_service_fee_rate, franchise_threshold, franchise_cap, switch_threshold, is_active)
VALUES
  ('FREE', 'producer', 0, 0.08, 0, 0, 100000, 8000, 250000, TRUE),
  ('STARTER', 'producer', 2500, 0.07, 0, 0, 200000, 12000, 500000, TRUE),
  ('PRO', 'producer', 7500, 0.06, 0, 0, 500000, 18000, NULL, TRUE),
  ('COOP_START', 'cooperative', 5000, 0.06, 0, 0, 300000, 12000, 1000000, TRUE),
  ('COOP_PRO', 'cooperative', 15000, 0.05, 0, 0, 1000000, 32000, NULL, TRUE),
  ('COOP_ENTERPRISE', 'cooperative', 0, 0.04, 0, 0, 0, 0, NULL, TRUE)
ON CONFLICT (name) DO NOTHING;
UPDATE public.pricing_plans AS current SET next_plan_id = next_plan.id FROM public.pricing_plans AS next_plan WHERE (current.name, next_plan.name) IN (('FREE', 'STARTER'), ('STARTER', 'PRO'), ('COOP_START', 'COOP_PRO'));
INSERT INTO public.pricing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pricing_plan_id UUID REFERENCES public.pricing_plans (id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_price NUMERIC, ADD COLUMN IF NOT EXISTS buyer_service_fee NUMERIC NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS seller_commission INTEGER, ADD COLUMN IF NOT EXISTS seller_net_amount INTEGER, ADD COLUMN IF NOT EXISTS pricing_plan_id UUID REFERENCES public.pricing_plans (id), ADD COLUMN IF NOT EXISTS commission_rate_applied NUMERIC;
UPDATE public.profiles AS profile SET pricing_plan_id = plan.id FROM public.pricing_plans AS plan WHERE profile.pricing_plan_id IS NULL AND plan.name = CASE WHEN profile.user_type = 'cooperative' AND profile.subscription_tier IN ('pro', 'premium', 'plus') THEN 'COOP_PRO' WHEN profile.user_type = 'cooperative' AND profile.subscription_tier IN ('enterprise', 'entreprise', 'business', 'biz') THEN 'COOP_ENTERPRISE' WHEN profile.user_type = 'cooperative' THEN 'COOP_START' WHEN profile.user_type IN ('producteur', 'farmer', 'processor', 'transformateur', 'artisan') AND profile.subscription_tier IN ('starter', 'essentiel', 'start') THEN 'STARTER' WHEN profile.user_type IN ('producteur', 'farmer', 'processor', 'transformateur', 'artisan') AND profile.subscription_tier IN ('pro', 'premium', 'plus', 'enterprise', 'entreprise', 'business', 'biz') THEN 'PRO' WHEN profile.user_type IN ('producteur', 'farmer', 'processor', 'transformateur', 'artisan') THEN 'FREE' ELSE NULL END;
