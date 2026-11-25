-- Rollback 084 — rétablit l'état prod relevé le 25/11/2026 (y compris la faille ; à n'utiliser qu'en urgence).
BEGIN;

DROP TRIGGER IF EXISTS trg_protect_profile_scg_insert ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_scg_on_insert();

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.scg_scores, public.scg_history
  TO anon, authenticated;

DROP POLICY IF EXISTS scg_scores_insert_own ON public.scg_scores;
CREATE POLICY scg_scores_insert_own ON public.scg_scores
  FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid() AS uid) = user_id);

COMMIT;
