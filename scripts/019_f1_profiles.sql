-- ============================================================
-- GWA PLATFORM — Migration F1 : Profils utilisateurs
-- ADDITIVE UNIQUEMENT — ne modifie pas les colonnes existantes
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_type TEXT
    CHECK (sub_type IN ('producteur_individuel','cooperative'))
    DEFAULT 'producteur_individuel',

  ADD COLUMN IF NOT EXISTS profile_completion_pct INT DEFAULT 0
    CHECK (profile_completion_pct BETWEEN 0 AND 100),

  -- Champs PRODUCTEUR INDIVIDUEL
  ADD COLUMN IF NOT EXISTS surface_ha NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS filieres TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mode_culture TEXT
    CHECK (mode_culture IN ('traditionnel','semi-intensif','intensif',NULL)),
  ADD COLUMN IF NOT EXISTS certif_bio BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS certif_fairtrade BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS annee_debut_activite INT,
  ADD COLUMN IF NOT EXISTS coordonnees_gps TEXT,

  -- Champs COOPERATIVE
  ADD COLUMN IF NOT EXISTS rccm_numero TEXT,
  ADD COLUMN IF NOT EXISTS rccm_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nb_membres INT,
  ADD COLUMN IF NOT EXISTS nb_hectares_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS president_name TEXT,
  ADD COLUMN IF NOT EXISTS secretary_name TEXT,
  ADD COLUMN IF NOT EXISTS commercial_contact TEXT,
  ADD COLUMN IF NOT EXISTS coop_type TEXT
    CHECK (coop_type IN ('GIE','SCOOP','SA','SARL','association',NULL)),
  ADD COLUMN IF NOT EXISTS zones_production TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capacite_stockage_tonnes NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS a_vehicule_transport BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coop_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Abonnement
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
    CHECK (subscription_tier IN ('free','starter','pro','enterprise')),

  -- Securite et audit
  ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
    CHECK (role IN ('user','admin','support')),

  -- Push notifications
  ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE;

-- Index essentiels
CREATE INDEX IF NOT EXISTS idx_profiles_sub_type    ON public.profiles(sub_type);
CREATE INDEX IF NOT EXISTS idx_profiles_filieres    ON public.profiles USING gin(filieres);
CREATE INDEX IF NOT EXISTS idx_profiles_coop_id     ON public.profiles(coop_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type   ON public.profiles(user_type);

-- ============================================================
-- Trigger : calcul automatique profile_completion_pct
-- ============================================================
CREATE OR REPLACE FUNCTION calc_profile_completion()
RETURNS TRIGGER AS $$
DECLARE v_pct INT := 0;
BEGIN
  -- Champs communs (50 pts max)
  IF NEW.full_name IS NOT NULL AND length(NEW.full_name) > 2  THEN v_pct := v_pct + 10; END IF;
  IF NEW.phone IS NOT NULL                                     THEN v_pct := v_pct + 10; END IF;
  IF NEW.city IS NOT NULL                                      THEN v_pct := v_pct + 5;  END IF;
  IF NEW.avatar_url IS NOT NULL                                THEN v_pct := v_pct + 10; END IF;
  IF NEW.bio IS NOT NULL AND length(NEW.bio) > 20              THEN v_pct := v_pct + 5;  END IF;
  IF NEW.sub_type IS NOT NULL                                  THEN v_pct := v_pct + 10; END IF;

  -- Champs spécifiques producteur (50 pts)
  IF NEW.sub_type = 'producteur_individuel' THEN
    IF NEW.surface_ha IS NOT NULL                              THEN v_pct := v_pct + 15; END IF;
    IF array_length(NEW.filieres, 1) > 0                       THEN v_pct := v_pct + 20; END IF;
    IF NEW.coordonnees_gps IS NOT NULL                         THEN v_pct := v_pct + 15; END IF;
  -- Champs spécifiques cooperative (50 pts)
  ELSIF NEW.sub_type = 'cooperative' THEN
    IF NEW.president_name IS NOT NULL                          THEN v_pct := v_pct + 10; END IF;
    IF NEW.nb_membres IS NOT NULL                              THEN v_pct := v_pct + 10; END IF;
    IF NEW.rccm_numero IS NOT NULL                             THEN v_pct := v_pct + 15; END IF;
    IF array_length(NEW.zones_production, 1) > 0               THEN v_pct := v_pct + 15; END IF;
  END IF;

  NEW.profile_completion_pct := LEAST(v_pct, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_completion ON public.profiles;
CREATE TRIGGER trg_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION calc_profile_completion();

-- ============================================================
-- Mettre à jour le trigger handle_new_user pour inclure sub_type et role
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, user_type, phone, country, city,
    sub_type, role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'producteur'),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'country', 'CI'),
    COALESCE(NEW.raw_user_meta_data ->> 'city', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'sub_type', 'producteur_individuel'),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
