-- 076 — Module 1 : lecture sécurisée du profil de l'utilisateur connecté (PII, cf. 037)
-- À appliquer manuellement. Idempotent.
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.* FROM public.profiles p WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
