-- ============================================================
-- GWA — Migration F2 : Extension table products
-- ADDITIVE UNIQUEMENT
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sub_type_vendeur TEXT
    CHECK (sub_type_vendeur IN ('producteur_individuel','cooperative')),
  ADD COLUMN IF NOT EXISTS filiere TEXT DEFAULT 'autre'
    CHECK (filiere IN ('manioc','riz','cacao','cajou','tomate','oignon',
                       'banane_plantain','piment','attieke','autre')),
  ADD COLUMN IF NOT EXISTS quantite_disponible_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quantite_min_commande_kg NUMERIC(10,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prix_unitaire_fcfa INT,
  ADD COLUMN IF NOT EXISTS prix_negocie BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS conditionnement TEXT,
  ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS coordonnees_gps TEXT,
  ADD COLUMN IF NOT EXISTS product_status TEXT DEFAULT 'brouillon'
    CHECK (product_status IN ('brouillon','actif','rupture','archive')),
  ADD COLUMN IF NOT EXISTS favoris_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prix_ocpv_ref_fcfa INT;

-- Table favoris produits
CREATE TABLE IF NOT EXISTS public.product_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fav_owner" ON public.product_favorites;
CREATE POLICY "fav_owner" ON public.product_favorites FOR ALL USING (auth.uid() = user_id);

-- Index performances catalogue
CREATE INDEX IF NOT EXISTS idx_products_filiere  ON public.products(filiere);
CREATE INDEX IF NOT EXISTS idx_products_region   ON public.products(region);
CREATE INDEX IF NOT EXISTS idx_products_prix_fcfa ON public.products(prix_unitaire_fcfa);
CREATE INDEX IF NOT EXISTS idx_products_search
  ON public.products USING gin(to_tsvector('french', COALESCE(name,'') || ' ' || COALESCE(description,'')));

-- Trigger : passer en rupture si quantite <= 0
CREATE OR REPLACE FUNCTION check_stock_rupture()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantite_disponible_kg IS NOT NULL AND NEW.quantite_disponible_kg <= 0 THEN
    NEW.product_status := 'rupture';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_rupture ON public.products;
CREATE TRIGGER trg_stock_rupture
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION check_stock_rupture();
