-- 045: likes + réponses sur commentaires (posts)
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_likes_comment_idx ON public.comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_idx ON public.comment_likes (user_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comment_likes_select ON public.comment_likes;
CREATE POLICY comment_likes_select ON public.comment_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS comment_likes_insert ON public.comment_likes;
CREATE POLICY comment_likes_insert ON public.comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS comment_likes_delete ON public.comment_likes;
CREATE POLICY comment_likes_delete ON public.comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- parent_comment_id déjà présent sur post_comments (003) — s'assurer de l'index
CREATE INDEX IF NOT EXISTS post_comments_parent_idx
  ON public.post_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- Compteur likes (best-effort trigger)
CREATE OR REPLACE FUNCTION public.gwa_sync_comment_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE post_comments
    SET likes_count = coalesce(likes_count, 0) + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE post_comments
    SET likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_likes_count ON public.comment_likes;
CREATE TRIGGER trg_comment_likes_count
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_comment_likes_count();

-- Autoriser type notification verification (+ garder digest)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'order'::text,
    'message'::text,
    'review'::text,
    'system'::text,
    'promotion'::text,
    'digest'::text,
    'verification'::text
  ]));

COMMENT ON TABLE public.comment_likes IS 'Likes sur commentaires de posts';
