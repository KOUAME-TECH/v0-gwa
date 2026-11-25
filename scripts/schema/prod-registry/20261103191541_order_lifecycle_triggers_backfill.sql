-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261103191541 · nom « order_lifecycle_triggers_backfill » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE OR REPLACE FUNCTION public.orders_sync_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next TEXT;
BEGIN
  v_next := CASE
    WHEN NEW.status = 'cancelled' THEN 'cancelled'
    WHEN NEW.status = 'disputed' OR NEW.escrow_status = 'frozen' THEN 'disputed'
    WHEN NEW.confirmed_by_buyer_at IS NOT NULL OR NEW.status = 'completed' OR (NEW.status = 'delivered' AND NEW.escrow_status = 'released') THEN 'completed'
    WHEN NEW.status = 'delivered' THEN 'delivered'
    WHEN NEW.status IN ('shipped', 'shipping') THEN 'shipped'
    WHEN NEW.status IN ('processing', 'preparing') THEN 'processing'
    WHEN NEW.payment_status = 'paid' OR NEW.escrow_status = 'held' OR NEW.status = 'paid' THEN 'paid'
    ELSE 'pending'
  END;
  NEW.lifecycle_status := v_next;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.orders_record_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.lifecycle_status ELSE NULL END;
BEGIN
  IF TG_OP = 'INSERT' OR v_prev IS DISTINCT FROM NEW.lifecycle_status THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, reason)
    VALUES (NEW.id, v_prev, NEW.lifecycle_status, NEW.status_changed_by, NULLIF(BTRIM(COALESCE(NEW.status_change_reason, '')), ''));
    IF TG_OP = 'UPDATE' AND NEW.buyer_id IS NOT NULL AND NEW.seller_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, body, link, is_read, read)
      VALUES
        (NEW.buyer_id, 'order', 'Commande mise à jour', 'Votre commande passe à : ' || NEW.lifecycle_status, NEW.lifecycle_status, '/dashboard/commandes', FALSE, FALSE),
        (NEW.seller_id, 'order', 'Commande mise à jour', 'Une commande passe à : ' || NEW.lifecycle_status, NEW.lifecycle_status, '/dashboard/commandes', FALSE, FALSE);
    END IF;
    UPDATE public.orders SET status_change_reason = NULL, status_changed_by = NULL WHERE id = NEW.id AND (status_change_reason IS NOT NULL OR status_changed_by IS NOT NULL);
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_orders_sync_lifecycle ON public.orders;
CREATE TRIGGER trg_orders_sync_lifecycle BEFORE INSERT OR UPDATE OF status, payment_status, escrow_status, confirmed_by_buyer_at ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_sync_lifecycle();
DROP TRIGGER IF EXISTS trg_orders_record_lifecycle ON public.orders;
CREATE TRIGGER trg_orders_record_lifecycle AFTER INSERT OR UPDATE OF status, payment_status, escrow_status, confirmed_by_buyer_at ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_record_lifecycle();
ALTER TABLE public.orders DISABLE TRIGGER trg_protect_order_privileged;
UPDATE public.orders SET lifecycle_status = CASE WHEN status = 'cancelled' THEN 'cancelled' WHEN status = 'disputed' OR escrow_status = 'frozen' THEN 'disputed' WHEN confirmed_by_buyer_at IS NOT NULL OR status = 'completed' OR (status = 'delivered' AND escrow_status = 'released') THEN 'completed' WHEN status = 'delivered' THEN 'delivered' WHEN status IN ('shipped','shipping') THEN 'shipped' WHEN status IN ('processing','preparing') THEN 'processing' WHEN payment_status = 'paid' OR escrow_status = 'held' OR status = 'paid' THEN 'paid' ELSE 'pending' END;
INSERT INTO public.order_status_history (order_id, from_status, to_status, reason)
SELECT id, NULL, lifecycle_status, 'Reprise du cycle existant' FROM public.orders WHERE lifecycle_status IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_id = orders.id);
ALTER TABLE public.orders ENABLE TRIGGER trg_protect_order_privileged;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_status_history_select_party ON public.order_status_history;
CREATE POLICY order_status_history_select_party ON public.order_status_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));
