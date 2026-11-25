-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260718223954 · nom « profiles_select_restore_directory » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
REVOKE SELECT (email, phone, linked_email, address, suspended_reason, suspended_at, suspended_by, onesignal_player_id) ON public.profiles FROM anon;
GRANT SELECT (email, phone, linked_email, address, suspended_reason, suspended_at, suspended_by, onesignal_player_id) ON public.profiles TO authenticated;
