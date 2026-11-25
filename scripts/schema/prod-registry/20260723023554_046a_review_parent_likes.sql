-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260723023554 · nom « 046a_review_parent_likes » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS parent_review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS reviews_parent_idx ON public.reviews (parent_review_id) WHERE parent_review_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, user_id)
);
CREATE INDEX IF NOT EXISTS review_likes_review_idx ON public.review_likes (review_id);
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_likes_select ON public.review_likes;
CREATE POLICY review_likes_select ON public.review_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS review_likes_insert ON public.review_likes;
CREATE POLICY review_likes_insert ON public.review_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS review_likes_delete ON public.review_likes;
CREATE POLICY review_likes_delete ON public.review_likes FOR DELETE USING (auth.uid() = user_id);

UPDATE public.posts p SET comments_count = (SELECT count(*)::int FROM public.post_comments c WHERE c.post_id = p.id);
UPDATE public.products pr SET comments_count = (SELECT count(*)::int FROM public.reviews r WHERE r.product_id = pr.id AND r.parent_review_id IS NULL);
