-- 083 — Score de Confiance GWA (SCG) : échelle 0 à 1000, maximum 1000 (directive de Yao, 25/11/2026).
-- NE PAS APPLIQUER sans le go de Yao. Idempotent. Rollback : 083_scg_max_1000.rollback.sql.
--
-- Relevé prod en lecture seule le 25/11/2026 vers 12:15 (Africa/Abidjan) :
--   profiles.scg_score       : 16 lignes, min 0, max 209 (2 > 0)
--   scg_scores.score_total   : 42 lignes, min 70, max 220
--   scg_history.score_total  : 10 lignes, min 70, max 209
--   factoring_requests.scg_score_snapshot : 0 ligne
--   → toutes les valeurs sont déjà sur l'échelle 0–1000 : AUCUNE CONVERSION de données.
--   Aucune contrainte CHECK n'existait sur ces colonnes.
--
-- Méthode : contraintes NOT VALID (pas de scan sous verrou fort), puis VALIDATE
-- (verrou SHARE UPDATE EXCLUSIVE, les écritures continuent). Le bloc de contrôle
-- échoue AVANT toute modification si une valeur hors bornes est apparue depuis le relevé.

BEGIN;

DO $$
DECLARE
  bad bigint;
BEGIN
  SELECT
      (SELECT count(*) FROM public.profiles           WHERE scg_score          NOT BETWEEN 0 AND 1000)
    + (SELECT count(*) FROM public.scg_scores         WHERE score_total        NOT BETWEEN 0 AND 1000)
    + (SELECT count(*) FROM public.scg_history        WHERE score_total        NOT BETWEEN 0 AND 1000)
    + (SELECT count(*) FROM public.factoring_requests WHERE scg_score_snapshot NOT BETWEEN 0 AND 1000)
  INTO bad;
  IF bad > 0 THEN
    RAISE EXCEPTION '083 : % valeur(s) SCG hors de [0, 1000]. Arrêt : voir la conversion commentée en bas du fichier.', bad;
  END IF;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_scg_score_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_scg_score_range CHECK (scg_score BETWEEN 0 AND 1000) NOT VALID;

ALTER TABLE public.scg_scores DROP CONSTRAINT IF EXISTS scg_scores_score_total_range;
ALTER TABLE public.scg_scores
  ADD CONSTRAINT scg_scores_score_total_range CHECK (score_total BETWEEN 0 AND 1000) NOT VALID;

ALTER TABLE public.scg_history DROP CONSTRAINT IF EXISTS scg_history_score_total_range;
ALTER TABLE public.scg_history
  ADD CONSTRAINT scg_history_score_total_range CHECK (score_total BETWEEN 0 AND 1000) NOT VALID;

ALTER TABLE public.factoring_requests DROP CONSTRAINT IF EXISTS factoring_requests_scg_score_snapshot_range;
ALTER TABLE public.factoring_requests
  ADD CONSTRAINT factoring_requests_scg_score_snapshot_range CHECK (scg_score_snapshot BETWEEN 0 AND 1000) NOT VALID;

ALTER TABLE public.profiles           VALIDATE CONSTRAINT profiles_scg_score_range;
ALTER TABLE public.scg_scores         VALIDATE CONSTRAINT scg_scores_score_total_range;
ALTER TABLE public.scg_history        VALIDATE CONSTRAINT scg_history_score_total_range;
ALTER TABLE public.factoring_requests VALIDATE CONSTRAINT factoring_requests_scg_score_snapshot_range;

COMMENT ON COLUMN public.profiles.scg_score IS 'Score de Confiance GWA, échelle 0 à 1000 (maximum 1000).';
COMMENT ON COLUMN public.scg_scores.score_total IS 'Score de Confiance GWA, échelle 0 à 1000 (maximum 1000).';

COMMIT;

-- Post-contrôle :
-- SELECT conrelid::regclass, conname, convalidated, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conname LIKE '%scg%range';
--
-- Conversion (NON nécessaire au 25/11/2026, à n'utiliser que si le contrôle ci-dessus échoue) :
-- les valeurs > 1000 ne peuvent venir que d'une écriture hors moteur (le moteur borne à 1000).
-- Les borner plutôt que les mettre à l'échelle, puis relancer ce fichier :
--   UPDATE public.profiles    SET scg_score   = LEAST(GREATEST(scg_score, 0), 1000)   WHERE scg_score   NOT BETWEEN 0 AND 1000;
--   UPDATE public.scg_scores  SET score_total = LEAST(GREATEST(score_total, 0), 1000) WHERE score_total NOT BETWEEN 0 AND 1000;
--   UPDATE public.scg_history SET score_total = LEAST(GREATEST(score_total, 0), 1000) WHERE score_total NOT BETWEEN 0 AND 1000;
--   UPDATE public.factoring_requests SET scg_score_snapshot = LEAST(GREATEST(scg_score_snapshot, 0), 1000)
--     WHERE scg_score_snapshot NOT BETWEEN 0 AND 1000;
