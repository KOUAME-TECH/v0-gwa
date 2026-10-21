-- 059 — Order rows must be created by validated server routes, never by clients.
DROP POLICY IF EXISTS "orders_insert_buyer" ON public.orders;
DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
