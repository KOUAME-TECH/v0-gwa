-- 056 — Colonnes privilégiées profils : service_role uniquement
-- Corrige le bypass double identité (admin JWT pouvait s'auto-attribuer
-- subscription_tier / is_verified via profiles_update_own).
-- Les APIs admin utilisent déjà createAdminClient() = service_role.

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
  -- Seul le service_role (APIs serveur) peut muter les colonnes sensibles
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
  NEW.rating := OLD.rating;
  NEW.total_reviews := OLD.total_reviews;

  -- Identité téléphone : OTP only
  NEW.phone := OLD.phone;
  NEW.phone_verified := OLD.phone_verified;

  -- Type de compte : pas de self-service
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

COMMENT ON FUNCTION public.protect_profile_privileged_columns() IS
  'Bloque les écritures client (y compris JWT admin) sur colonnes privilégiées ; service_role seul.';
