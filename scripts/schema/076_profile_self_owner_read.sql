-- 076_profile_self_owner_read.sql
-- NON APPLIQUÉ. La fonction existe déjà en production (audit lecture seule).
--
-- RLS public.profiles (prod) :
--   profiles_select_all  SELECT  USING (true)
--   profiles_insert_own  INSERT  WITH CHECK (auth.uid() = id)
--   profiles_update_own  UPDATE  USING (auth.uid() = id)
--   profiles_delete_own  DELETE  USING (auth.uid() = id)
--
-- Le mur « Connectez-vous » ne vient pas d'une policy SELECT trop étroite.
-- `authenticated` n'a pas le privilège SELECT au niveau table, ni sur les
-- colonnes PII (email, phone, linked_email, address, suspended_*, …).
-- `SELECT *` échoue donc en entier : 42501 permission denied for table profiles.
--
-- Ne pas GRANT SELECT de ces colonnes à authenticated : profiles_select_all
-- est USING (true), un GRANT exposerait le PII de tous les comptes.
-- La lecture du compte courant passe par profile_self(), SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.profile_self()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT *
  FROM public.profiles
  WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.profile_self() IS
  'Ligne profiles du compte courant, y compris les colonnes sans GRANT SELECT. Ne remplace pas une policy RLS.';

-- anon ne doit pas exécuter profile_self(). Un GRANT TO anon rejoué après
-- le REVOKE élargi le réaccorderait. PUBLIC est révoqué explicitement
-- (EXECUTE est accordé à PUBLIC par défaut à la création).
REVOKE EXECUTE ON FUNCTION public.profile_self() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_self() TO authenticated, service_role;
