-- 081 — Index manquants signalés par QA (advisor « unindexed foreign keys »), Lot D.
-- NE PAS APPLIQUER sans le go de Yao. Idempotent.
-- CONCURRENTLY : pas de verrou d'écriture ; à exécuter HORS transaction (pas de BEGIN/COMMIT).
-- Vérifié en lecture seule le 25/11/2026 10:30 (Africa/Abidjan) : colonnes uuid présentes, aucun index existant.

CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_payout_plan_id_at_payment_idx
  ON public.orders (payout_plan_id_at_payment);

CREATE INDEX CONCURRENTLY IF NOT EXISTS withdrawal_requests_processing_by_idx
  ON public.withdrawal_requests (processing_by);

-- Post-contrôle :
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE indexname IN ('orders_payout_plan_id_at_payment_idx', 'withdrawal_requests_processing_by_idx');
-- SELECT indexrelid::regclass, indisvalid FROM pg_index
--  WHERE indexrelid IN ('public.orders_payout_plan_id_at_payment_idx'::regclass, 'public.withdrawal_requests_processing_by_idx'::regclass);
