-- 046: sync comments_count + likes/réponses sur avis produits + digest notif = nouveautés seules

-- 1) Resync compteurs posts
UPDATE public.posts p
SET comments_count = (
  SELECT count(*)::int FROM public.post_comments c WHERE c.post_id = p.id
);

-- 2) Resync compteurs produits (reviews)
UPDATE public.products pr
SET comments_count = (
  SELECT count(*)::int FROM public.reviews r WHERE r.product_id = pr.id
)
WHERE EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='products' AND column_name='comments_count');

-- 3) Trigger posts : toujours recalculer
CREATE OR REPLACE FUNCTION public.gwa_sync_post_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE posts
  SET comments_count = (SELECT count(*)::int FROM post_comments WHERE post_id = pid)
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_post_comments_count ON public.post_comments;
CREATE TRIGGER trg_sync_post_comments_count
  AFTER INSERT OR DELETE OR UPDATE OF post_id ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_post_comments_count();

-- 4) Avis produits : parent + likes
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS parent_review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS reviews_parent_idx
  ON public.reviews (parent_review_id)
  WHERE parent_review_id IS NOT NULL;

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
CREATE POLICY review_likes_insert ON public.review_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS review_likes_delete ON public.review_likes;
CREATE POLICY review_likes_delete ON public.review_likes
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.gwa_sync_review_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  -- Compter seulement les racines (pas les réponses)
  UPDATE products
  SET comments_count = (
    SELECT count(*)::int FROM reviews
    WHERE product_id = pid AND parent_review_id IS NULL
  )
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_comments_count ON public.reviews;
CREATE TRIGGER trg_sync_product_comments_count
  AFTER INSERT OR DELETE OR UPDATE OF product_id, parent_review_id ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.gwa_sync_product_comments_count();

-- 5) Digest cron : NOTIFIER seulement s'il y a de vraies nouveautés (24h ou 7j)
--    Pas de fallback "newest" pour les push (évite spam catalogue stagnant)
CREATE OR REPLACE FUNCTION public.run_harmattan_digest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  matched_count int;
  sample_ids uuid[];
  notifs_inserted int := 0;
  users_processed int := 0;
  skipped_none int := 0;
  result jsonb;
  city_tok text;
  window_hours int;
  since_ts timestamptz;
  link_path text;
  mode_label text;
BEGIN
  FOR rec IN
    SELECT
      p.id,
      p.city,
      p.country,
      coalesce(p.digest_enabled, true) AS digest_enabled
    FROM profiles p
    WHERE coalesce(p.digest_enabled, true) = true
      AND (
        (p.city IS NOT NULL AND btrim(p.city) <> '')
        OR (p.country IS NOT NULL AND btrim(p.country) <> '')
      )
  LOOP
    users_processed := users_processed + 1;
    city_tok := public.gwa_digest_city_token(rec.city);
    matched_count := 0;
    sample_ids := ARRAY[]::uuid[];
    mode_label := NULL;
    since_ts := now() - interval '24 hours';

    -- Uniquement nouveautés 24h puis 7j (pas 30j / newest pour les notifs)
    FOREACH window_hours IN ARRAY ARRAY[24, 168]
    LOOP
      since_ts := now() - (window_hours || ' hours')::interval;
      SELECT
        count(*)::int,
        coalesce(array_agg(pr.id) FILTER (WHERE pr.id IS NOT NULL), ARRAY[]::uuid[])
      INTO matched_count, sample_ids
      FROM (
        SELECT pr.id
        FROM products pr
        WHERE pr.status = 'active'
          AND pr.created_at IS NOT NULL
          AND pr.created_at >= since_ts
          AND (
            (
              city_tok <> ''
              AND (
                lower(coalesce(pr.ville, '')) LIKE '%' || city_tok || '%'
                OR lower(coalesce(pr.origin_region, '')) LIKE '%' || city_tok || '%'
                OR lower(coalesce(pr.region, '')) LIKE '%' || city_tok || '%'
                OR lower(coalesce(pr.origin_country, '')) LIKE '%' || city_tok || '%'
              )
            )
            OR public.gwa_digest_country_match(
              coalesce(pr.origin_country, '') || ' ' || coalesce(pr.origin_region, '') || ' ' || coalesce(pr.region, '') || ' ' || coalesce(pr.ville, ''),
              rec.country
            )
          )
        ORDER BY pr.created_at DESC NULLS LAST
        LIMIT 10
      ) pr;

      IF matched_count > 0 THEN
        mode_label := CASE window_hours WHEN 24 THEN 'regional_24h' ELSE 'regional_7d' END;
        EXIT;
      END IF;
    END LOOP;

    -- Rien de nouveau → pas de notification
    IF matched_count IS NULL OR matched_count = 0 OR mode_label IS NULL THEN
      skipped_none := skipped_none + 1;
      CONTINUE;
    END IF;

    link_path := '/marketplace?digest=1&since=' || to_char(since_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      || '&ids=' || array_to_string(sample_ids, ',');

    INSERT INTO notifications (
      user_id, type, title, message, body, link, is_read, read, data
    ) VALUES (
      rec.id,
      'digest',
      'Harmattan Digest — ' || coalesce(nullif(btrim(rec.city), ''), nullif(btrim(rec.country), ''), 'chez vous'),
      CASE
        WHEN matched_count = 1 THEN '1 nouveau produit près de chez vous — écoutez'
        ELSE matched_count::text || ' nouveaux produits près de chez vous — écoutez'
      END,
      CASE
        WHEN matched_count = 1 THEN '1 nouveau produit près de chez vous — écoutez'
        ELSE matched_count::text || ' nouveaux produits près de chez vous — écoutez'
      END,
      link_path,
      false,
      false,
      jsonb_build_object(
        'type', 'harmattan_digest',
        'count', matched_count,
        'product_ids', to_jsonb(sample_ids),
        'since', since_ts,
        'mode', mode_label
      )
    );

    UPDATE profiles
    SET digest_last_sent_at = now()
    WHERE id = rec.id;

    notifs_inserted := notifs_inserted + 1;
  END LOOP;

  result := jsonb_build_object(
    'ok', true,
    'source', 'supabase_pg_cron',
    'users_processed', users_processed,
    'notifications_inserted', notifs_inserted,
    'skipped_no_products', skipped_none,
    'version', '046'
  );

  INSERT INTO digest_runs (result) VALUES (result);
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'ok', false,
      'source', 'supabase_pg_cron',
      'error', SQLERRM,
      'version', '046'
    );
    INSERT INTO digest_runs (result) VALUES (result);
    RETURN result;
END;
$$;

COMMENT ON FUNCTION public.run_harmattan_digest() IS
  'Digest push uniquement si nouveautés 24h/7j (046)';
