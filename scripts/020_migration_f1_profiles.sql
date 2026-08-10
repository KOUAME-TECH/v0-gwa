-- ============================================================
-- GWA — Migration F1 : Extension table profiles
-- ADDITIVE UNIQUEMENT — n'affecte pas les colonnes existantes
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Colonnes sous-type et completion
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_type TEXT
    CHECK (sub_type IN ('producteur_individuel','cooperative'))
    DEFAULT 'producteur_individuel',
  ADD COLUMN IF NOT EXISTS profile_completion_pct INT DEFAULT 0
    CHECK (profile_completion_pct BETWEEN 0 AND 100);

-- 2. Colonnes spécifiques PRODUCTEUR INDIVIDUEL
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS surface_ha NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS filieres TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mode_culture TEXT
    CHECK (mode_culture IN ('traditionnel','semi-intensif','intensif') OR mode_culture IS NULL),
  ADD COLUMN IF NOT EXISTS certif_bio BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS certif_fairtrade BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS annee_debut_activite INT,
  ADD COLUMN IF NOT EXISTS coordonnees_gps TEXT;

-- 3. Colonnes spécifiques COOPERATIVE
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rccm_numero TEXT,
  ADD COLUMN IF NOT EXISTS rccm_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nb_membres INT,
  ADD COLUMN IF NOT EXISTS nb_hectares_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS president_name TEXT,
  ADD COLUMN IF NOT EXISTS secretary_name TEXT,
  ADD COLUMN IF NOT EXISTS commercial_contact TEXT,
  ADD COLUMN IF NOT EXISTS coop_type TEXT
    CHECK (coop_type IN ('GIE','SCOOP','SA','SARL','association') OR coop_type IS NULL),
  ADD COLUMN IF NOT EXISTS zones_production TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capacite_stockage_tonnes NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS a_vehicule_transport BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coop_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Abonnement
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free','starter','pro','enterprise'));

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_profiles_sub_type ON public.profiles(sub_type);
CREATE INDEX IF NOT EXISTS idx_profiles_filieres ON public.profiles USING gin(filieres);
CREATE INDEX IF NOT EXISTS idx_profiles_coop_id ON public.profiles(coop_id);

-- 6. Trigger calcul automatique profile_completion_pct
CREATE OR REPLACE FUNCTION calc_profile_completion()
RETURNS TRIGGER AS $$
DECLARE v_pct INT := 0;
BEGIN
  IF NEW.full_name IS NOT NULL THEN v_pct := v_pct + 10; END IF;
  IF NEW.phone    IS NOT NULL THEN v_pct := v_pct + 10; END IF;
  IF NEW.city     IS NOT NULL THEN v_pct := v_pct + 5;  END IF;
  IF NEW.avatar_url IS NOT NULL THEN v_pct := v_pct + 10; END IF;
  IF NEW.bio IS NOT NULL AND length(NEW.bio) > 20 THEN v_pct := v_pct + 5; END IF;
  IF NEW.sub_type IS NOT NULL THEN v_pct := v_pct + 10; END IF;

  IF NEW.sub_type = 'producteur_individuel' THEN
    IF NEW.surface_ha IS NOT NULL THEN v_pct := v_pct + 15; END IF;
    IF array_length(NEW.filieres, 1) > 0 THEN v_pct := v_pct + 20; END IF;
    IF NEW.coordonnees_gps IS NOT NULL THEN v_pct := v_pct + 15; END IF;
  ELSIF NEW.sub_type = 'cooperative' THEN
    IF NEW.president_name IS NOT NULL THEN v_pct := v_pct + 10; END IF;
    IF NEW.nb_membres IS NOT NULL THEN v_pct := v_pct + 10; END IF;
    IF NEW.rccm_numero IS NOT NULL THEN v_pct := v_pct + 15; END IF;
    IF array_length(NEW.zones_production, 1) > 0 THEN v_pct := v_pct + 15; END IF;
  END IF;

  NEW.profile_completion_pct := LEAST(v_pct, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_completion ON public.profiles;
CREATE TRIGGER trg_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION calc_profile_completion();
