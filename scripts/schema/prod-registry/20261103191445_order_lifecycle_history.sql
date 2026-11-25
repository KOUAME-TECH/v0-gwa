-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261103191445 · nom « order_lifecycle_history » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check CHECK (status IN ('draft','pending','paid','confirmed','processing','shipped','delivered','completed','cancelled','disputed'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS lifecycle_status TEXT, ADD COLUMN IF NOT EXISTS status_change_reason TEXT, ADD COLUMN IF NOT EXISTS status_changed_by UUID, ADD COLUMN IF NOT EXISTS confirmed_by_buyer_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.order_status_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE, from_status TEXT, to_status TEXT NOT NULL, actor_id UUID, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history (order_id, created_at);
