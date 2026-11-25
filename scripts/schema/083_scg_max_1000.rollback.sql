-- Rollback 083 — retire les contraintes d'échelle SCG (aucune donnée n'est modifiée par 083).
BEGIN;
ALTER TABLE public.profiles           DROP CONSTRAINT IF EXISTS profiles_scg_score_range;
ALTER TABLE public.scg_scores         DROP CONSTRAINT IF EXISTS scg_scores_score_total_range;
ALTER TABLE public.scg_history        DROP CONSTRAINT IF EXISTS scg_history_score_total_range;
ALTER TABLE public.factoring_requests DROP CONSTRAINT IF EXISTS factoring_requests_scg_score_snapshot_range;
COMMENT ON COLUMN public.profiles.scg_score IS NULL;
COMMENT ON COLUMN public.scg_scores.score_total IS NULL;
COMMIT;
