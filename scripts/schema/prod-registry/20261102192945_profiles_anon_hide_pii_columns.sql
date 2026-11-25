-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261102192945 · nom « profiles_anon_hide_pii_columns » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

-- AXE 5 audit: anon could read email/phone via profiles_select_all + full table GRANT.
-- Keep marketplace-safe columns public; hide PII and internal fields from anon.
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT (
  id,
  full_name,
  avatar_url,
  user_type,
  country,
  city,
  bio,
  is_verified,
  rating,
  total_reviews,
  production_type,
  craft_type,
  experience_years,
  member_count,
  scg_score,
  scg_badge,
  scg_bancable,
  sub_type,
  subscription_tier,
  filieres,
  mode_culture,
  certif_bio,
  certif_fairtrade,
  annee_debut_activite,
  nb_membres,
  nb_hectares_total,
  coop_type,
  zones_production,
  capacite_stockage_tonnes,
  a_vehicule_transport,
  created_at
) ON TABLE public.profiles TO anon;
-- authenticated keeps full row access (own + public marketplace via RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
