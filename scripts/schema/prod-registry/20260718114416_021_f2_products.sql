-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260718114416 · nom « 021_f2_products » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sub_type_vendeur TEXT,
  ADD COLUMN IF NOT EXISTS filiere TEXT DEFAULT 'autre',
  ADD COLUMN IF NOT EXISTS quantite_disponible_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quantite_min_commande_kg NUMERIC(10,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prix_unitaire_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prix_negocie BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS conditionnement TEXT,
  ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS coordonnees_gps TEXT,
  ADD COLUMN IF NOT EXISTS offer_status TEXT DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favoris_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prix_ocpv_ref_fcfa INT;
CREATE TABLE IF NOT EXISTS public.product_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fav_owner ON public.product_favorites;
CREATE POLICY fav_owner ON public.product_favorites FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_products_filiere ON public.products(filiere);
CREATE INDEX IF NOT EXISTS idx_products_region ON public.products(region);
CREATE INDEX IF NOT EXISTS idx_products_seller ON public.products(seller_id);
