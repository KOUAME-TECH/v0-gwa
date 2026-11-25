-- 082 — Drapeaux de fonctionnalité : wallet masqué (GSAC-2)
-- Directive CEO (Yao, 25/11) : « Masquer immédiatement les pages /wallet et /payout
-- via un Feature Flag. Le wallet reste invisible jusqu'à l'agrément BCEAO (M+12). »
--
-- NE PAS appliquer en prod sans le go écrit de Yao qui nomme ce fichier.
-- Exécution humaine dans l'éditeur SQL Supabase uniquement. Rollback : 082_feature_flags_wallet.rollback.sql
--
-- La table public.feature_flags existe déjà en prod (071) :
--   name text PK, is_active_public bool, is_active_beta bool, description text
-- + policy feature_flags_read (SELECT anon, authenticated USING true).
-- Cette migration est idempotente et ne modifie aucune ligne existante.
--
-- Le code est fail-closed : sans cette migration (ligne `wallet` absente),
-- le wallet est déjà masqué. 082 rend l'état explicite et prépare le back-office.

BEGIN;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  name text PRIMARY KEY,
  is_active_public boolean NOT NULL DEFAULT false,
  is_active_beta boolean NOT NULL DEFAULT false,
  description text
);

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

INSERT INTO public.feature_flags (name, is_active_public, is_active_beta, description)
VALUES (
  'wallet',
  false,
  false,
  'Pages /wallet et /payout, API /api/wallet/* : masquées jusqu''à l''agrément BCEAO (M+12)'
)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Lecture publique (drapeaux non sensibles, lus par le proxy avec la clé publique).
DROP POLICY IF EXISTS feature_flags_read ON public.feature_flags;
CREATE POLICY feature_flags_read
  ON public.feature_flags
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Écriture : admins actifs (super_admin, admin) uniquement. Le back-office écrit
-- normalement en service role ; cette policy est une défense en profondeur.
DROP POLICY IF EXISTS feature_flags_admin_update ON public.feature_flags;
CREATE POLICY feature_flags_admin_update
  ON public.feature_flags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = (SELECT auth.uid())
        AND ar.is_active = true
        AND ar.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = (SELECT auth.uid())
        AND ar.is_active = true
        AND ar.role IN ('super_admin', 'admin')
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.feature_flags FROM anon;
REVOKE INSERT, DELETE, TRUNCATE ON public.feature_flags FROM authenticated;
REVOKE UPDATE ON public.feature_flags FROM authenticated;
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT UPDATE (is_active_public, is_active_beta, description, updated_at, updated_by)
  ON public.feature_flags TO authenticated;

COMMIT;

-- Vérification (lecture seule) :
-- SELECT name, is_active_public, is_active_beta, updated_at FROM public.feature_flags ORDER BY name;
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'feature_flags';
