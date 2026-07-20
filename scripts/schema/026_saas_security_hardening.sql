-- 026_saas_security_hardening.sql
-- Harden privileged columns, revoke dangerous RPCs, fix search_path

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone)
  WHERE phone IS NOT NULL;

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

CREATE OR REPLACE FUNCTION public.protect_order_privileged_columns()
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

  NEW.payment_status := OLD.payment_status;
  NEW.escrow_status := OLD.escrow_status;
  NEW.total_amount := OLD.total_amount;
  NEW.subtotal := OLD.subtotal;
  NEW.shipping_cost := OLD.shipping_cost;
  NEW.service_fee := OLD.service_fee;
  NEW.commission_pct := OLD.commission_pct;
  NEW.commission_fcfa := OLD.commission_fcfa;
  NEW.vendeur_recoit_fcfa := OLD.vendeur_recoit_fcfa;
  NEW.buyer_id := OLD.buyer_id;
  NEW.seller_id := OLD.seller_id;
  NEW.feexpay_ref := OLD.feexpay_ref;

  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_privileged ON public.orders;
CREATE TRIGGER trg_protect_order_privileged
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_privileged_columns();

REVOKE ALL ON FUNCTION public.promote_to_admin(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_to_admin(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.update_post_likes_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_post_likes_count() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.update_post_comments_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_post_comments_count() FROM anon, authenticated;

DO $$ BEGIN
  ALTER FUNCTION public.generate_order_number() SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.generate_rfq_number() SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.promote_to_admin(text, text) SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.is_room_member(text) SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.calc_profile_completion() SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.snapshot_scg_daily() SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.update_post_likes_count() SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.update_post_comments_count() SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_order_privileged_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_order_privileged_columns() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_room_member(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_room_member(text) FROM anon, authenticated;
