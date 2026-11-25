-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260820113728 · nom « product_like_dislike_064 » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

-- 064: Likes + dislikes produit + gel compteurs sociaux client
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dislikes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.product_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS product_likes_product_id_idx ON public.product_likes (product_id);
CREATE INDEX IF NOT EXISTS product_likes_user_id_idx ON public.product_likes (user_id);
ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_likes_select_all ON public.product_likes;
CREATE POLICY product_likes_select_all ON public.product_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS product_likes_insert_own ON public.product_likes;
CREATE POLICY product_likes_insert_own ON public.product_likes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS product_likes_delete_own ON public.product_likes;
CREATE POLICY product_likes_delete_own ON public.product_likes FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.gwa_sync_product_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products SET likes_count = coalesce(likes_count, 0) + 1 WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products SET likes_count = greatest(coalesce(likes_count, 0) - 1, 0) WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_product_likes_count ON public.product_likes;
CREATE TRIGGER trg_product_likes_count AFTER INSERT OR DELETE ON public.product_likes FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_product_likes_count();
REVOKE ALL ON FUNCTION public.gwa_sync_product_likes_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gwa_sync_product_likes_count() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_sync_product_likes_count() TO postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.product_likes TO authenticated;
GRANT SELECT ON public.product_likes TO anon;

CREATE TABLE IF NOT EXISTS public.product_dislikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS product_dislikes_product_id_idx ON public.product_dislikes (product_id);
CREATE INDEX IF NOT EXISTS product_dislikes_user_id_idx ON public.product_dislikes (user_id);
ALTER TABLE public.product_dislikes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_dislikes_select_all ON public.product_dislikes;
CREATE POLICY product_dislikes_select_all ON public.product_dislikes FOR SELECT USING (true);
DROP POLICY IF EXISTS product_dislikes_insert_own ON public.product_dislikes;
CREATE POLICY product_dislikes_insert_own ON public.product_dislikes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS product_dislikes_delete_own ON public.product_dislikes;
CREATE POLICY product_dislikes_delete_own ON public.product_dislikes FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.gwa_sync_product_dislikes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products SET dislikes_count = coalesce(dislikes_count, 0) + 1 WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products SET dislikes_count = greatest(coalesce(dislikes_count, 0) - 1, 0) WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_product_dislikes_count ON public.product_dislikes;
CREATE TRIGGER trg_product_dislikes_count AFTER INSERT OR DELETE ON public.product_dislikes FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_product_dislikes_count();
REVOKE ALL ON FUNCTION public.gwa_sync_product_dislikes_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gwa_sync_product_dislikes_count() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_sync_product_dislikes_count() TO postgres, service_role;
GRANT SELECT, INSERT, DELETE ON public.product_dislikes TO authenticated;
GRANT SELECT ON public.product_dislikes TO anon;

CREATE OR REPLACE FUNCTION public.gwa_product_reaction_mutex()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'product_likes' THEN
    DELETE FROM public.product_dislikes WHERE product_id = NEW.product_id AND user_id = NEW.user_id;
  ELSIF TG_TABLE_NAME = 'product_dislikes' THEN
    DELETE FROM public.product_likes WHERE product_id = NEW.product_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_product_like_mutex ON public.product_likes;
CREATE TRIGGER trg_product_like_mutex BEFORE INSERT ON public.product_likes FOR EACH ROW EXECUTE FUNCTION public.gwa_product_reaction_mutex();
DROP TRIGGER IF EXISTS trg_product_dislike_mutex ON public.product_dislikes;
CREATE TRIGGER trg_product_dislike_mutex BEFORE INSERT ON public.product_dislikes FOR EACH ROW EXECUTE FUNCTION public.gwa_product_reaction_mutex();
REVOKE ALL ON FUNCTION public.gwa_product_reaction_mutex() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gwa_product_reaction_mutex() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_product_reaction_mutex() TO postgres, service_role;

UPDATE public.products p SET
  likes_count = (SELECT count(*)::int FROM public.product_likes pl WHERE pl.product_id = p.id),
  dislikes_count = (SELECT count(*)::int FROM public.product_dislikes pd WHERE pd.product_id = p.id);

CREATE OR REPLACE FUNCTION public.protect_product_social_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF current_setting('role', true) IN ('authenticated', 'anon') THEN
    NEW.likes_count := OLD.likes_count;
    NEW.dislikes_count := OLD.dislikes_count;
    NEW.shares_count := OLD.shares_count;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_product_social_counters ON public.products;
CREATE TRIGGER trg_protect_product_social_counters BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.protect_product_social_counters();

CREATE OR REPLACE FUNCTION public.protect_post_social_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF current_setting('role', true) IN ('authenticated', 'anon') THEN
    NEW.likes_count := OLD.likes_count;
    NEW.shares_count := OLD.shares_count;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_post_social_counters ON public.posts;
CREATE TRIGGER trg_protect_post_social_counters BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.protect_post_social_counters();

REVOKE ALL ON FUNCTION public.protect_product_social_counters() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_product_social_counters() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_product_social_counters() TO postgres, service_role;
REVOKE ALL ON FUNCTION public.protect_post_social_counters() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_post_social_counters() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_post_social_counters() TO postgres, service_role;
