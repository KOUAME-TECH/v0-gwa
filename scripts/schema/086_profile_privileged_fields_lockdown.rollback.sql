-- Rollback 086 : revient à l'état d'avant 086 (trigger UPDATE d'origine en prod,
-- + trigger INSERT SCG de 084 si 084 est appliquée). Les droits TRUNCATE/REFERENCES/TRIGGER
-- ne sont pas rendus (ils n'étaient pas utilisés).
BEGIN;
DROP TRIGGER IF EXISTS trg_protect_verification_request_insert ON public.verification_requests;
DROP FUNCTION IF EXISTS public.protect_verification_request_insert();
DROP TRIGGER IF EXISTS trg_0_protect_profile_privileged ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_scg_insert ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_privileged_fields();
DROP FUNCTION IF EXISTS public.profile_request_is_member();

-- Fonction d'origine (copie de la prod au 25/11/2026)
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
CREATE TRIGGER trg_protect_profile_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

DO $$
BEGIN
  IF to_regprocedure('public.protect_profile_scg_on_insert()') IS NOT NULL THEN
    EXECUTE 'CREATE TRIGGER trg_protect_profile_scg_insert BEFORE INSERT ON public.profiles
             FOR EACH ROW EXECUTE FUNCTION public.protect_profile_scg_on_insert()';
  END IF;
END $$;
COMMIT;
