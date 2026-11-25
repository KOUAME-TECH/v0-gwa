-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260810185918 · nom « 064_freeze_social_counters » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE OR REPLACE FUNCTION public.protect_post_social_counters()
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
  NEW.likes_count := OLD.likes_count;
  NEW.shares_count := OLD.shares_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_post_social_counters ON public.posts;
CREATE TRIGGER trg_protect_post_social_counters
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_post_social_counters();

CREATE OR REPLACE FUNCTION public.protect_product_social_counters()
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
  NEW.likes_count := OLD.likes_count;
  NEW.shares_count := OLD.shares_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_product_social_counters ON public.products;
CREATE TRIGGER trg_protect_product_social_counters
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_product_social_counters();
