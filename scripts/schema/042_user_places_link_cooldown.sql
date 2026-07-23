-- GWA 042 — Lieux GPS (champs, entrepôts…) + cooldown liaison email/tél
-- Idempotent.

-- Coordonnées profil (position principale)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_linked_at timestamptz;

COMMENT ON COLUMN public.profiles.latitude IS 'Dernière position GPS autorisée (WGS84)';
COMMENT ON COLUMN public.profiles.longitude IS 'Dernière position GPS autorisée (WGS84)';
COMMENT ON COLUMN public.profiles.email_linked_at IS 'Date de liaison email réussie — cooldown modification';
COMMENT ON COLUMN public.profiles.phone_linked_at IS 'Date de liaison téléphone OTP — cooldown modification';

-- Lieux fixés (champ, entrepôt, marché, domicile…)
CREATE TABLE IF NOT EXISTS public.user_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_type text NOT NULL
    CHECK (place_type IN ('domicile', 'champ', 'entrepot', 'marche', 'autre')),
  label text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  city text,
  country text,
  region text,
  address text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_places_user ON public.user_places(user_id);
CREATE INDEX IF NOT EXISTS idx_user_places_primary ON public.user_places(user_id) WHERE is_primary;

ALTER TABLE public.user_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_places_select_own" ON public.user_places;
CREATE POLICY "user_places_select_own" ON public.user_places
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_places_insert_own" ON public.user_places;
CREATE POLICY "user_places_insert_own" ON public.user_places
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_places_update_own" ON public.user_places;
CREATE POLICY "user_places_update_own" ON public.user_places
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_places_delete_own" ON public.user_places;
CREATE POLICY "user_places_delete_own" ON public.user_places
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Un seul lieu primaire par user
CREATE OR REPLACE FUNCTION public.user_places_ensure_single_primary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary IS TRUE THEN
    UPDATE public.user_places
    SET is_primary = false, updated_at = now()
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_primary IS TRUE;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_places_primary ON public.user_places;
CREATE TRIGGER trg_user_places_primary
  BEFORE INSERT OR UPDATE OF is_primary ON public.user_places
  FOR EACH ROW
  EXECUTE FUNCTION public.user_places_ensure_single_primary();
