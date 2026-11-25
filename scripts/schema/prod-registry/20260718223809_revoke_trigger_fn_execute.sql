-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260718223809 · nom « revoke_trigger_fn_execute » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_order_privileged_columns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_order_privileged_columns() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_room_member(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_room_member(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_member(text) TO service_role;
