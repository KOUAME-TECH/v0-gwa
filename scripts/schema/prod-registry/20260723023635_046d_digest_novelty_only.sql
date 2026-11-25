-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260723023635 · nom « 046d_digest_novelty_only » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

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
    SELECT p.id, p.city, p.country, coalesce(p.digest_enabled, true) AS digest_enabled
    FROM profiles p
    WHERE coalesce(p.digest_enabled, true) = true
      AND ((p.city IS NOT NULL AND btrim(p.city) <> '') OR (p.country IS NOT NULL AND btrim(p.country) <> ''))
  LOOP
    users_processed := users_processed + 1;
    city_tok := public.gwa_digest_city_token(rec.city);
    matched_count := 0;
    sample_ids := ARRAY[]::uuid[];
    mode_label := NULL;
    since_ts := now() - interval '24 hours';

    FOREACH window_hours IN ARRAY ARRAY[24, 168]
    LOOP
      since_ts := now() - (window_hours || ' hours')::interval;
      SELECT count(*)::int,
        coalesce(array_agg(pr.id) FILTER (WHERE pr.id IS NOT NULL), ARRAY[]::uuid[])
      INTO matched_count, sample_ids
      FROM (
        SELECT pr.id FROM products pr
        WHERE pr.status = 'active'
          AND pr.created_at IS NOT NULL AND pr.created_at >= since_ts
          AND (
            (city_tok <> '' AND (
              lower(coalesce(pr.ville, '')) LIKE '%' || city_tok || '%'
              OR lower(coalesce(pr.origin_region, '')) LIKE '%' || city_tok || '%'
              OR lower(coalesce(pr.region, '')) LIKE '%' || city_tok || '%'
              OR lower(coalesce(pr.origin_country, '')) LIKE '%' || city_tok || '%'
            ))
            OR public.gwa_digest_country_match(
              coalesce(pr.origin_country, '') || ' ' || coalesce(pr.origin_region, '') || ' ' || coalesce(pr.region, '') || ' ' || coalesce(pr.ville, ''),
              rec.country
            )
          )
        ORDER BY pr.created_at DESC NULLS LAST LIMIT 10
      ) pr;
      IF matched_count > 0 THEN
        mode_label := CASE window_hours WHEN 24 THEN 'regional_24h' ELSE 'regional_7d' END;
        EXIT;
      END IF;
    END LOOP;

    IF matched_count IS NULL OR matched_count = 0 OR mode_label IS NULL THEN
      skipped_none := skipped_none + 1;
      CONTINUE;
    END IF;

    link_path := '/marketplace?digest=1&since=' || to_char(since_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      || '&ids=' || array_to_string(sample_ids, ',');

    INSERT INTO notifications (user_id, type, title, message, body, link, is_read, read, data) VALUES (
      rec.id, 'digest',
      'Harmattan Digest — ' || coalesce(nullif(btrim(rec.city), ''), nullif(btrim(rec.country), ''), 'chez vous'),
      CASE WHEN matched_count = 1 THEN '1 nouveau produit près de chez vous — écoutez'
           ELSE matched_count::text || ' nouveaux produits près de chez vous — écoutez' END,
      CASE WHEN matched_count = 1 THEN '1 nouveau produit près de chez vous — écoutez'
           ELSE matched_count::text || ' nouveaux produits près de chez vous — écoutez' END,
      link_path, false, false,
      jsonb_build_object('type','harmattan_digest','count',matched_count,'product_ids',to_jsonb(sample_ids),'since',since_ts,'mode',mode_label)
    );

    UPDATE profiles SET digest_last_sent_at = now() WHERE id = rec.id;
    notifs_inserted := notifs_inserted + 1;
  END LOOP;

  result := jsonb_build_object('ok', true, 'source', 'supabase_pg_cron', 'users_processed', users_processed,
    'notifications_inserted', notifs_inserted, 'skipped_no_products', skipped_none, 'version', '046');
  INSERT INTO digest_runs (result) VALUES (result);
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result := jsonb_build_object('ok', false, 'source', 'supabase_pg_cron', 'error', SQLERRM, 'version', '046');
  INSERT INTO digest_runs (result) VALUES (result);
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.run_harmattan_digest() IS 'Digest push uniquement si nouveautés 24h/7j (046)';
