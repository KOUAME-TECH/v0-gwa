-- Rollback 085 — supprime la fonction d'entrée 5C et les colonnes 5C de scg_scores.
-- Attention : les sous-scores 5C et explications déjà écrits sont perdus (le score total reste).
BEGIN;
DROP FUNCTION IF EXISTS public.scg_5c_inputs(uuid);
ALTER TABLE public.scg_scores DROP CONSTRAINT IF EXISTS scg_scores_5c_range;
ALTER TABLE public.scg_scores
  DROP COLUMN IF EXISTS explain,
  DROP COLUMN IF EXISTS c_conditions,
  DROP COLUMN IF EXISTS c_collateral,
  DROP COLUMN IF EXISTS c_capital,
  DROP COLUMN IF EXISTS c_capacity,
  DROP COLUMN IF EXISTS c_character,
  DROP COLUMN IF EXISTS model_version;
COMMIT;
