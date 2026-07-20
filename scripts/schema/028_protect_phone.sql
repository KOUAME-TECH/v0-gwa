-- 028_protect_phone.sql
-- HIGH-1 hardening: freeze profiles.phone / profiles.phone_verified for normal users.
-- A phone may only be written by the service_role (after a successful OTP in
-- /api/auth/verify-otp) or by an active admin. Any UPDATE from anon/authenticated
-- keeps the OLD phone + phone_verified values (anti phone-binding / OTP takeover).

-- Ensure the verification flag exists (used by send-otp/verify-otp login gating).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

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

  -- HIGH-1: phone identity is OTP-proof only (written via service_role).
  NEW.phone := OLD.phone;
  NEW.phone_verified := OLD.phone_verified;

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
