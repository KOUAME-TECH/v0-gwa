-- 041 Harmattan Digest via Supabase pg_cron (pas de dépendance Vercel CRON_SECRET)
-- Idempotent

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Journal léger des runs (résilience / debug)
CREATE TABLE IF NOT EXISTS public.digest_runs (
  id BIGSERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.digest_runs IS 'Historique des exécutions Harmattan Digest (pg_cron)';

CREATE OR REPLACE FUNCTION public.run_harmattan_digest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since_ts timestamptz := now() - interval '24 hours';
  rec record;
  matched_count int;
  sample_ids uuid[];
  notifs_inserted int := 0;
  users_processed int := 0;
  skipped_none int := 0;
  result jsonb;
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
            rec.city IS NOT NULL
            AND (
              lower(coalesce(pr.ville, '')) LIKE '%' || lower(rec.city) || '%'
              OR lower(coalesce(pr.origin_region, '')) LIKE '%' || lower(rec.city) || '%'
              OR lower(coalesce(pr.region, '')) LIKE '%' || lower(rec.city) || '%'
            )
          )
          OR (
            rec.country IS NOT NULL
            AND lower(coalesce(pr.origin_country, '')) LIKE '%' || lower(rec.country) || '%'
          )
        )
      ORDER BY pr.created_at DESC NULLS LAST
      LIMIT 10
    ) pr;

    IF matched_count IS NULL OR matched_count = 0 THEN
      skipped_none := skipped_none + 1;
      CONTINUE;
    END IF;

    INSERT INTO notifications (
      user_id, type, title, message, body, link, is_read, read, data
    ) VALUES (
      rec.id,
      'digest',
      'Harmattan Digest — ' || coalesce(nullif(btrim(rec.city), ''), nullif(btrim(rec.country), ''), 'chez vous'),
      CASE
        WHEN matched_count = 1 THEN '1 nouveau produit près de chez vous — écoutez le parcours'
        ELSE matched_count::text || ' nouveaux produits près de chez vous — écoutez le parcours'
      END,
      CASE
        WHEN matched_count = 1 THEN '1 nouveau produit près de chez vous — écoutez le parcours'
        ELSE matched_count::text || ' nouveaux produits près de chez vous — écoutez le parcours'
      END,
      '/marketplace?digest=1',
      false,
      false,
      jsonb_build_object(
        'type', 'harmattan_digest',
        'count', matched_count,
        'product_ids', to_jsonb(sample_ids),
        'since', since_ts
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
    'since', since_ts
  );

  INSERT INTO digest_runs (result) VALUES (result);
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'ok', false,
      'source', 'supabase_pg_cron',
      'error', SQLERRM
    );
    INSERT INTO digest_runs (result) VALUES (result);
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.run_harmattan_digest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_harmattan_digest() TO service_role;

-- Planifie 06:00 UTC chaque jour (déschedule l’ancien nom si présent)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'gwa-harmattan-digest-daily';
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'gwa-harmattan-digest-daily',
  '0 6 * * *',
  $cron$SELECT public.run_harmattan_digest();$cron$
);
