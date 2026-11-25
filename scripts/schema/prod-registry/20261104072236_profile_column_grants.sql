-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261104072236 · nom « profile_column_grants » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, full_name, avatar_url, bio, user_type, country, city, is_verified, rating, total_reviews,
  production_type, surface_area, craft_type, experience_years, member_count, registration_number,
  created_at, updated_at, is_suspended, scg_criteria, scg_score, onboarding_completed, interests,
  scg_badge, scg_bancable, scg_calculated_at, sub_type, profile_completion_pct, preferred_language,
  onboarding_completed_at, surface_ha, filieres, mode_culture, certif_bio, certif_fairtrade,
  annee_debut_activite, rccm_verified, nb_membres, nb_hectares_total, coop_type, zones_production,
  capacite_stockage_tonnes, a_vehicule_transport, coop_id, subscription_tier, digest_enabled,
  digest_last_sent_at, subscription_expires_at, pricing_plan_id
) ON TABLE public.profiles TO anon, authenticated;
