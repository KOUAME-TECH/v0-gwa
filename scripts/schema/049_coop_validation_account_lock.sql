-- 049_coop_validation_account_lock.sql
-- Politique coopérative : qualification progressive + gel user_type self-service.

-- 1) Colonnes cooperatives
ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending_validation';

ALTER TABLE public.cooperatives
  DROP CONSTRAINT IF EXISTS cooperatives_validation_status_check;

ALTER TABLE public.cooperatives
  ADD CONSTRAINT cooperatives_validation_status_check
  CHECK (validation_status IN (
    'pending_validation',
    'members_ok',
    'qualified',
    'restricted',
    'suspended'
  ));

ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS members_deadline_at TIMESTAMPTZ;

ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS docs_deadline_at TIMESTAMPTZ;

ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS restriction_started_at TIMESTAMPTZ;

ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;

-- Backfill deadlines pour coops existantes (à partir de created_at)
UPDATE public.cooperatives
SET
  members_deadline_at = COALESCE(members_deadline_at, created_at + INTERVAL '14 days'),
  docs_deadline_at = COALESCE(docs_deadline_at, created_at + INTERVAL '6 months')
WHERE members_deadline_at IS NULL OR docs_deadline_at IS NULL;

-- Nouvelles coops : statut validation par défaut (déjà DEFAULT)
COMMENT ON COLUMN public.cooperatives.validation_status IS
  'pending_validation | members_ok | qualified | restricted | suspended — politique GWA qualification progressive';

-- 2) Gel user_type / sub_type / coop_id hors service_role et admin
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
  is_admin boolean := false;
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = auth.uid() AND ar.is_active = true
  ) INTO is_admin;

  IF is_admin THEN
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
  NEW.rating := OLD.rating;
  NEW.total_reviews := OLD.total_reviews;

  -- Identité téléphone : OTP only
  NEW.phone := OLD.phone;
  NEW.phone_verified := OLD.phone_verified;

  -- Type de compte : pas de self-service (inscription / admin / service_role seulement)
  NEW.user_type := OLD.user_type;
  NEW.sub_type := OLD.sub_type;
  NEW.coop_id := OLD.coop_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM anon, authenticated;
