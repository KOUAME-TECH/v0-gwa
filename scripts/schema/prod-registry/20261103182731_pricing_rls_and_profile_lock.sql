-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261103182731 · nom « pricing_rls_and_profile_lock » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), auth.role());
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
CREATE POLICY pricing_plans_select_active ON public.pricing_plans FOR SELECT TO anon, authenticated USING (is_active = TRUE);
DROP POLICY IF EXISTS pricing_switch_select_own ON public.pricing_switch_notices;
CREATE POLICY pricing_switch_select_own ON public.pricing_switch_notices FOR SELECT TO authenticated USING (seller_id = auth.uid());
