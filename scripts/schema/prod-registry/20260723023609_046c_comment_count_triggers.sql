-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260723023609 · nom « 046c_comment_count_triggers » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE OR REPLACE FUNCTION public.gwa_sync_post_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE posts SET comments_count = (SELECT count(*)::int FROM post_comments WHERE post_id = pid) WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_post_comments_count ON public.post_comments;
CREATE TRIGGER trg_sync_post_comments_count
  AFTER INSERT OR DELETE OR UPDATE OF post_id ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_post_comments_count();

CREATE OR REPLACE FUNCTION public.gwa_sync_review_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reviews SET likes_count = coalesce(likes_count, 0) + 1 WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews SET likes_count = greatest(coalesce(likes_count, 0) - 1, 0) WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_review_likes_count ON public.review_likes;
CREATE TRIGGER trg_review_likes_count
  AFTER INSERT OR DELETE ON public.review_likes
  FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_review_likes_count();

CREATE OR REPLACE FUNCTION public.gwa_sync_product_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products SET comments_count = (
    SELECT count(*)::int FROM reviews WHERE product_id = pid AND parent_review_id IS NULL
  ) WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_product_comments_count ON public.reviews;
CREATE TRIGGER trg_sync_product_comments_count
  AFTER INSERT OR DELETE OR UPDATE OF product_id, parent_review_id ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_product_comments_count();
