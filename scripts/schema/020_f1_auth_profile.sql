-- F1 Auth OTP + Profil — champs additionnels (idempotent)
-- À exécuter dans Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sub_type TEXT,
  ADD COLUMN IF NOT EXISTS profile_completion_pct INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auth_method TEXT CHECK (auth_method IN ('phone', 'email')),
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Mise à jour du trigger handle_new_user pour les nouveaux champs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_method TEXT;
  v_user_type TEXT;
BEGIN
  v_auth_method := CASE
    WHEN NEW.phone IS NOT NULL AND NEW.phone <> '' THEN 'phone'
    WHEN NEW.email IS NOT NULL THEN 'email'
    ELSE NULL
  END;

  v_user_type := COALESCE(
    NEW.raw_user_meta_data ->> 'user_type',
    'acheteur'
  );

  INSERT INTO public.profiles (
    id, email, full_name, user_type, phone, country, city,
    auth_method, profile_completion_pct, sub_type
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    v_user_type,
    COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'country', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'city', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'auth_method', v_auth_method),
    0,
    COALESCE(NEW.raw_user_meta_data ->> 'sub_type', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    auth_method = COALESCE(EXCLUDED.auth_method, profiles.auth_method),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Index pour recherche par téléphone (connexion rapide)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone)
  WHERE phone IS NOT NULL;

COMMENT ON COLUMN public.profiles.auth_method IS 'Méthode d''inscription: phone (OTP SMS) ou email';
COMMENT ON COLUMN public.profiles.profile_completion_pct IS 'Pourcentage de complétion du profil (0-100)';
