-- ROLLBACK 082 — ne jamais exécuter en prod sans go écrit de Yao.
-- Ne supprime PAS la table feature_flags (créée par 071, utilisée par RFQ et appels vidéo).
-- Supprimer la ligne `wallet` laisse le wallet masqué (code fail-closed).

BEGIN;

DROP POLICY IF EXISTS feature_flags_admin_update ON public.feature_flags;
REVOKE UPDATE ON public.feature_flags FROM authenticated;

DELETE FROM public.feature_flags WHERE name = 'wallet';

ALTER TABLE public.feature_flags
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS updated_at;

COMMIT;
