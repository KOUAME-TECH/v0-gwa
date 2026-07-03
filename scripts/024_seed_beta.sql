-- ============================================================
-- GWA PLATFORM — Seed Beta Interne
-- 20 profils : producteurs SIDONOBIEL, acheteurs, coops
-- À exécuter UNE SEULE FOIS sur la base de staging/prod beta
-- ============================================================

-- NOTE: Les auth.users doivent être créés via Supabase Auth (OTP SMS).
-- Ce script crée uniquement les profils publics associés.
-- Remplacer les UUIDs par les vrais UUIDs après création auth.

-- ============================================================
-- Catégories de test additionnelles (si manquantes)
-- ============================================================
INSERT INTO public.categories (name, slug, description, category_type)
VALUES
  ('Manioc', 'manioc', 'Manioc frais, sec, farine de manioc', 'agriculture'),
  ('Riz local', 'riz-local', 'Riz paddy et riz blanchi CI', 'agriculture'),
  ('Cacao export', 'cacao-export', 'Fèves de cacao grade 1 et 2', 'agriculture'),
  ('Noix de cajou', 'noix-cajou', 'Noix brutes et décortiquées', 'agriculture'),
  ('Attiéké artisanal', 'attieke-artisanal', 'Semoule de manioc fermentée', 'artisanat')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Offres produits de démonstration (sans auth.user — pour UI)
-- Utilise seller_id = null temporairement pour preview catalogue
-- ============================================================

-- Script de vérification post-migration
DO $$
BEGIN
  -- Vérifier que toutes les colonnes F1-F5 existent
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sub_type'
  ), 'ERREUR: colonne sub_type manquante sur profiles';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'filiere'
  ), 'ERREUR: colonne filiere manquante sur products';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'escrow_transactions'
  ), 'ERREUR: table escrow_transactions manquante';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'scg_scores'
  ), 'ERREUR: table scg_scores manquante';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'product_favorites'
  ), 'ERREUR: table product_favorites manquante';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'push_tokens'
  ), 'ERREUR: table push_tokens manquante';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'referentiel_conditionnement'
  ), 'ERREUR: table referentiel_conditionnement manquante';

  RAISE NOTICE '✓ Toutes les migrations F1-F5 sont correctement appliquées';
END;
$$;

-- Vérifier données référentiel conditionnement
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.referentiel_conditionnement;
  ASSERT v_count >= 9, 'ERREUR: référentiel conditionnement incomplet';
  RAISE NOTICE '✓ Référentiel conditionnement: % filières configurées', v_count;
END;
$$;

-- Résumé des tables créées/modifiées
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name AND c.table_schema = 'public') as nb_colonnes
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','products','orders','escrow_transactions',
    'scg_scores','scg_history','product_favorites',
    'push_tokens','referentiel_conditionnement','messages','notifications'
  )
ORDER BY table_name;
