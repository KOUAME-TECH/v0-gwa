-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260810024720 · nom « profiles_self_pii_security_definer » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

DROP VIEW IF EXISTS public.profiles_self_pii;
CREATE VIEW public.profiles_self_pii AS
SELECT
  id,
  email,
  phone,
  linked_email,
  address,
  onesignal_player_id
FROM public.profiles
WHERE id = auth.uid();
ALTER VIEW public.profiles_self_pii OWNER TO postgres;
GRANT SELECT ON public.profiles_self_pii TO authenticated;
GRANT SELECT ON public.profiles_self_pii TO service_role;
