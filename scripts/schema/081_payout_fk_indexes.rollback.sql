-- Rollback 081 (hors transaction).
DROP INDEX CONCURRENTLY IF EXISTS public.orders_payout_plan_id_at_payment_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.withdrawal_requests_processing_by_idx;
