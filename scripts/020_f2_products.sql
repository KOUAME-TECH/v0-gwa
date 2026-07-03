-- ============================================================
-- GWA PLATFORM — Migration F2 : Catalogue produits + favoris
-- ADDITIVE — ne modifie pas les colonnes existantes
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sub_type_vendeur TEXT
    CHECK (sub_type_vendeur IN ('producteur_individuel','cooperative')),
  ADD COLUMN IF NOT EXISTS filiere TEXT NOT NULL DEFAULT 'autre'
    CHECK (filiere IN (
      'manioc','riz','cacao','cajou','tomate','oignon',
      'banane_plantain','piment','attieke','autre'
    )),
  ADD COLUMN IF NOT EXISTS quantite_disponible_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS quantite_min_commande_kg NUMERIC(10,2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prix_unitaire_fcfa INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prix_negocie BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS conditionnement TEXT,
  ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS coordonnees_gps TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prix_ocpv_ref_fcfa INT,
  ADD COLUMN IF NOT EXISTS favoris_count INT DEFAULT 0;

-- Harmoniser la colonne status avec les valeurs F2
-- (la contrainte existante est plus large, on DROP + ADD)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check
  CHECK (status IN ('brouillon','actif','rupture','archive','draft','active','paused','sold_out'));

-- Index performances catalogue
CREATE INDEX IF NOT EXISTS idx_products_filiere   ON public.products(filiere);
CREATE INDEX IF NOT EXISTS idx_products_status    ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_region    ON public.products(region);
CREATE INDEX IF NOT EXISTS idx_products_prix      ON public.products(prix_unitaire_fcfa);
CREATE INDEX IF NOT EXISTS idx_products_seller    ON public.products(seller_id);

-- Recherche full-text français
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products
  USING gin(to_tsvector('french',
    COALESCE(name, '') || ' ' || COALESCE(description, '')
  ));

-- ============================================================
-- Table product_favorites (remplace/complète public.favorites)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_favorites (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS fav_owner_select ON public.product_favorites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS fav_owner_insert ON public.product_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS fav_owner_delete ON public.product_favorites
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_product_favorites_user    ON public.product_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_product_favorites_product ON public.product_favorites(product_id);

-- ============================================================
-- Trigger : maintenir favoris_count sur products
-- ============================================================
CREATE OR REPLACE FUNCTION update_product_favoris_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products SET favoris_count = favoris_count + 1 WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products SET favoris_count = GREATEST(favoris_count - 1, 0) WHERE id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_favoris_count ON public.product_favorites;
CREATE TRIGGER trg_product_favoris_count
  AFTER INSERT OR DELETE ON public.product_favorites
  FOR EACH ROW EXECUTE FUNCTION update_product_favoris_count();

-- ============================================================
-- Table referentiel_conditionnement (normes par filière)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.referentiel_conditionnement (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filiere          TEXT NOT NULL,
  conditionnements TEXT[] NOT NULL DEFAULT '{}',
  humidite_max_pct NUMERIC(5,2),
  calibres         TEXT[] DEFAULT '{}',
  specifications_requises TEXT[] DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(filiere)
);

ALTER TABLE public.referentiel_conditionnement ENABLE ROW LEVEL SECURITY;
CREATE POLICY ref_cond_public ON public.referentiel_conditionnement
  FOR SELECT USING (true);

-- Seed données référentiel (valeurs OCPV / normes CI officielles)
INSERT INTO public.referentiel_conditionnement
  (filiere, conditionnements, humidite_max_pct, calibres, specifications_requises, notes)
VALUES
  ('manioc',          ARRAY['sac_50kg','vrac_tonne','colis_25kg'],         14.0,
   ARRAY['grade_A','grade_B','tout_venant'],
   ARRAY['humidite_pct','calibre','date_recolte','lot_id'],
   'Référentiel OCPV Côte d''Ivoire — manioc frais et sec'),

  ('riz',             ARRAY['sac_50kg','sac_25kg','vrac_tonne'],           14.0,
   ARRAY['grade_1','grade_2','brise'],
   ARRAY['humidite_pct','calibre','date_recolte','lot_id'],
   'Normes OCPV + FAO pour riz paddy et riz blanchi'),

  ('cacao',           ARRAY['sac_60kg','sac_jute_65kg'],                    7.5,
   ARRAY['grade_1','grade_2','hors_grade'],
   ARRAY['humidite_pct','calibre','lot_id','date_recolte','coordonnees_gps'],
   'EUDR obligatoire — GPS parcelle requis. Norme ICCO/CCC'),

  ('cajou',           ARRAY['sac_80kg','vrac_tonne','sac_50kg'],            9.0,
   ARRAY['grade_W180','grade_W240','grade_W320','grade_W450','tout_venant'],
   ARRAY['humidite_pct','calibre','lot_id','date_recolte'],
   'Normes CCA — Conseil du Cajou de Côte d''Ivoire'),

  ('tomate',          ARRAY['colis_15kg','colis_10kg','caisse_plastique'],  NULL,
   ARRAY['calibre_57_67','calibre_47_57','tout_venant'],
   ARRAY['calibre','date_recolte','lot_id'],
   'Tomate fraîche — calibres CEE'),

  ('oignon',          ARRAY['sac_50kg','filet_25kg','colis_20kg'],          NULL,
   ARRAY['calibre_S','calibre_M','calibre_L'],
   ARRAY['calibre','date_recolte','lot_id'],
   'Oignon bulbe — conservation post-récolte'),

  ('banane_plantain', ARRAY['regime','colis_20kg','carton_18kg'],           NULL,
   ARRAY['extra','cat_1','cat_2'],
   ARRAY['calibre','date_recolte','lot_id'],
   'Banane plantain fraîche'),

  ('piment',          ARRAY['sac_10kg','colis_5kg','vrac'],                 NULL,
   ARRAY['frais','seche','poudre'],
   ARRAY['calibre','date_recolte','lot_id'],
   'Piment frais ou séché'),

  ('attieke',         ARRAY['sac_50kg','emballage_5kg','emballage_1kg'],   13.0,
   ARRAY['premium','standard'],
   ARRAY['humidite_pct','date_fabrication','lot_id'],
   'Attiéké — semoule de manioc fermentée'),

  ('autre',           ARRAY['sac_50kg','vrac','colis'],                     NULL,
   ARRAY['grade_A','grade_B','tout_venant'],
   ARRAY['lot_id','date_recolte'],
   'Filière générique')
ON CONFLICT (filiere) DO UPDATE SET
  conditionnements = EXCLUDED.conditionnements,
  humidite_max_pct = EXCLUDED.humidite_max_pct,
  calibres         = EXCLUDED.calibres,
  specifications_requises = EXCLUDED.specifications_requises,
  notes            = EXCLUDED.notes,
  updated_at       = now();
