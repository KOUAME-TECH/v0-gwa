-- 084 — SCG : plus aucune écriture directe par anon / authenticated (faille scg_scores_insert_own).
-- NE PAS APPLIQUER sans le go de Yao. Idempotent. Rollback : 084_scg_write_lockdown.rollback.sql.
--
-- Constat prod en lecture seule (25/11/2026 ~12:25, Africa/Abidjan) :
--   * scg_scores : policy INSERT « scg_scores_insert_own » (WITH CHECK auth.uid() = user_id, valeur libre)
--     + GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER à anon et authenticated.
--     L'insertion directe échoue aujourd'hui par accident : le trigger trg_scg_snapshot
--     (snapshot_scg_daily, SECURITY INVOKER) écrit dans scg_history, qui n'a qu'une policy SELECT.
--   * scg_history : mêmes GRANT larges ; seule la policy SELECT (propriétaire).
--   * profiles.scg_* : UPDATE neutralisé par trg_protect_profile_privileged (BEFORE UPDATE),
--     mais RIEN sur INSERT. Avec profiles_delete_own + profiles_insert_own, un compte sans
--     dépendances peut supprimer puis recréer son profil avec scg_score = 1000, scg_bancable = true.
-- Seules écritures légitimes : le serveur avec la service role (lib/scg/persist.ts) et les
-- fonctions SECURITY DEFINER (handle_new_user n'écrit pas de colonne SCG).

BEGIN;

-- 1) scg_scores / scg_history : lecture seule pour les rôles clients (RLS : leurs propres lignes).
DROP POLICY IF EXISTS scg_scores_insert_own ON public.scg_scores;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.scg_scores, public.scg_history
  FROM anon, authenticated, PUBLIC;

GRANT SELECT ON public.scg_scores, public.scg_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scg_scores, public.scg_history TO service_role;

-- 2) profiles.scg_* : à l'INSERT, un client (anon / authenticated) ne fixe jamais le SCG.
--    (L'UPDATE est déjà couvert par protect_profile_privileged_columns.)
CREATE OR REPLACE FUNCTION public.protect_profile_scg_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), '')
  );
BEGIN
  -- Requêtes PostgREST : rôle toujours présent. Seule la service role peut poser un SCG.
  -- Sans JWT (connexion directe postgres, triggers d'auth) : rien à neutraliser.
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.scg_score := 0;
  NEW.scg_badge := 'debut';
  NEW.scg_bancable := false;
  NEW.scg_calculated_at := NULL;
  NEW.scg_criteria := '{"kyc": 0, "network": 0, "quality": 0, "reviews": 0, "activity": 0, "transactions": 0}'::jsonb;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.protect_profile_scg_on_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_profile_scg_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_scg_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_scg_on_insert();

COMMIT;

-- Post-contrôle :
-- SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('scg_scores', 'scg_history');
--   → seulement scg_scores_select_own et scg_history_owner (SELECT)
-- SELECT table_name, grantee, string_agg(privilege_type, ',') FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name IN ('scg_scores', 'scg_history')
--    AND grantee IN ('anon', 'authenticated') GROUP BY 1, 2;
--   → authenticated : SELECT ; anon : rien
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'trg_protect_profile_scg_insert';
