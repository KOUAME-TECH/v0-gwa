-- 027_profiles_pii_hardening.sql
-- View publique + colonnes PII retirées pour anon (marketplace embeds restent OK)

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT
  id,
  full_name,
  avatar_url,
  bio,
  user_type,
  country,
  city,
  is_verified,
  rating,
  total_reviews,
  production_type,
  scg_score,
  scg_badge,
  scg_bancable,
  created_at,
  sub_type,
  profile_completion_pct
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Directory SELECT (requis pour embeds products→profiles)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

-- PII: anon ne peut pas lire email/téléphone/adresse
REVOKE SELECT (email, phone, linked_email, address, suspended_reason, suspended_at, suspended_by, onesignal_player_id)
  ON public.profiles FROM anon;

GRANT SELECT (email, phone, linked_email, address, suspended_reason, suspended_at, suspended_by, onesignal_player_id)
  ON public.profiles TO authenticated;
