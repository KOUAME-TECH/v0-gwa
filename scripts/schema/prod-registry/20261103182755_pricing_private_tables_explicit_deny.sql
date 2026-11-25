-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261103182755 · nom « pricing_private_tables_explicit_deny » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

DROP POLICY IF EXISTS pricing_settings_no_client ON public.pricing_settings;
CREATE POLICY pricing_settings_no_client ON public.pricing_settings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS pricing_audit_no_client ON public.pricing_plan_audit;
CREATE POLICY pricing_audit_no_client ON public.pricing_plan_audit FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
