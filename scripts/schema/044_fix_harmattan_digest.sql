-- 044: Harmattan Digest — matching géo robuste + fenêtres élargies + deep-link ids
-- Corrige: cron qui skippe tous les users (0 notif) quand catalogue peu actif / géo incomplète

CREATE OR REPLACE FUNCTION public.gwa_digest_city_token(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n text;
  parts text[];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '';
  END IF;
  n := lower(trim(both FROM raw));
  -- strip accents lightly for common FR chars
  n := translate(n, 'àáâãäåèéêëìíîïòóôõöùúûüýÿç', 'aaaaaaeeeeiiiioooouuuuyyc');
  parts := string_to_array(n, ',');
  IF array_length(parts, 1) IS NULL OR array_length(parts, 1) <= 1 THEN
    RETURN n;
  END IF;
  -- avant-dernier segment = souvent la ville
  RETURN trim(both FROM parts[array_length(parts, 1) - 1]);
END;
$$;

CREATE OR REPLACE FUNCTION public.gwa_digest_country_match(product_geo text, profile_country text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  pg text := lower(coalesce(product_geo, ''));
  pc text := lower(trim(both FROM coalesce(profile_country, '')));
BEGIN
  IF pc = '' OR pg = '' THEN
    RETURN false;
  END IF;
  pc := translate(pc, 'àáâãäåèéêëìíîïòóôõöùúûüýÿç', 'aaaaaaeeeeiiiioooouuuuyyc');
  pg := translate(pg, 'àáâãäåèéêëìíîïòóôõöùúûüýÿç', 'aaaaaaeeeeiiiioooouuuuyyc');

  IF pg LIKE '%' || pc || '%' OR pc LIKE '%' || pg || '%' THEN
    RETURN true;
  END IF;

  -- aliases CI / SN / …
  IF pc IN ('ci', 'cote d''ivoire', 'cote divoire', 'ivory coast')
     AND (pg LIKE '%ivoire%' OR pg LIKE '%ivory%' OR pg = 'ci') THEN
    RETURN true;
  END IF;
  IF pc IN ('sn', 'senegal', 'sénégal') AND (pg LIKE '%senegal%' OR pg = 'sn') THEN
    RETURN true;
  END IF;
  IF pc IN ('ml', 'mali') AND (pg LIKE '%mali%' OR pg = 'ml') THEN
    RETURN true;
  END IF;
  IF pc IN ('bf', 'burkina faso', 'burkina') AND (pg LIKE '%burkina%' OR pg = 'bf') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

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
    mode_label := 'newest';
    since_ts := now() - interval '365 days';

    -- 1) régional 24h → 7j → 30j
    FOREACH window_hours IN ARRAY ARRAY[24, 168, 720]
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
          AND (pr.created_at IS NULL OR pr.created_at >= since_ts)
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
        mode_label := CASE window_hours
          WHEN 24 THEN 'regional_24h'
          WHEN 168 THEN 'regional_7d'
          ELSE 'regional_30d'
        END;
        EXIT;
      END IF;
    END LOOP;

    -- 2) fallback : 5 plus récents actifs (évite Digest mort)
    IF matched_count IS NULL OR matched_count = 0 THEN
      since_ts := now() - interval '365 days';
      SELECT
        count(*)::int,
        coalesce(array_agg(pr.id) FILTER (WHERE pr.id IS NOT NULL), ARRAY[]::uuid[])
      INTO matched_count, sample_ids
      FROM (
        SELECT pr.id
        FROM products pr
        WHERE pr.status = 'active'
        ORDER BY pr.created_at DESC NULLS LAST
        LIMIT 5
      ) pr;
      mode_label := 'newest';
    END IF;

    IF matched_count IS NULL OR matched_count = 0 THEN
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
        WHEN matched_count = 1 THEN '1 produit à écouter près de chez vous'
        ELSE matched_count::text || ' produits à écouter près de chez vous'
      END,
      CASE
        WHEN matched_count = 1 THEN '1 produit à écouter près de chez vous'
        ELSE matched_count::text || ' produits à écouter près de chez vous'
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
    'version', '044'
  );

  INSERT INTO digest_runs (result) VALUES (result);
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'ok', false,
      'source', 'supabase_pg_cron',
      'error', SQLERRM,
      'version', '044'
    );
    INSERT INTO digest_runs (result) VALUES (result);
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.run_harmattan_digest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_harmattan_digest() TO service_role;
GRANT EXECUTE ON FUNCTION public.gwa_digest_city_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gwa_digest_country_match(text, text) TO service_role;

COMMENT ON FUNCTION public.run_harmattan_digest() IS
  'Harmattan Digest quotidien — matching géo + fallbacks (044)';

-- Autoriser type=digest (sinon INSERT échoue silencieusement dans le cron)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'order'::text,
    'message'::text,
    'review'::text,
    'system'::text,
    'promotion'::text,
    'digest'::text
  ]));
