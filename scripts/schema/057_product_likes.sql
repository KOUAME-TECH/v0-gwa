-- 057: Likes produits (séparés des favoris)
-- Heart = j'aime (public count) | Bookmark = favoris (privé)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.product_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS product_likes_product_id_idx
  ON public.product_likes (product_id);

CREATE INDEX IF NOT EXISTS product_likes_user_id_idx
  ON public.product_likes (user_id);

ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_likes_select_all ON public.product_likes;
CREATE POLICY product_likes_select_all
  ON public.product_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS product_likes_insert_own ON public.product_likes;
CREATE POLICY product_likes_insert_own
  ON public.product_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS product_likes_delete_own ON public.product_likes;
CREATE POLICY product_likes_delete_own
  ON public.product_likes FOR DELETE
  USING (user_id = auth.uid());

-- Compteur atomique via trigger (évite races client .update likes_count)
CREATE OR REPLACE FUNCTION public.gwa_sync_product_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
    SET likes_count = coalesce(likes_count, 0) + 1
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
    SET likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_likes_count ON public.product_likes;
CREATE TRIGGER trg_product_likes_count
  AFTER INSERT OR DELETE ON public.product_likes
  FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_product_likes_count();

-- Resync best-effort si des likes existent déjà
UPDATE public.products p
SET likes_count = (
  SELECT count(*)::int FROM public.product_likes pl WHERE pl.product_id = p.id
);

REVOKE ALL ON FUNCTION public.gwa_sync_product_likes_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gwa_sync_product_likes_count() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_sync_product_likes_count() TO postgres, service_role;

GRANT SELECT, INSERT, DELETE ON public.product_likes TO authenticated;
GRANT SELECT ON public.product_likes TO anon;
