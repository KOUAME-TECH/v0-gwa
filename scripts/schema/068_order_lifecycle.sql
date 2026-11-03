-- 068 — Cycle de vie des commandes, historique atomique, statuts manquants.
-- Corrige aussi protect_order_privileged_columns, qui assignait encore feexpay_ref.

CREATE OR REPLACE FUNCTION public.protect_order_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    auth.role()
  );
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.payment_status := OLD.payment_status;
  NEW.escrow_status := OLD.escrow_status;
  NEW.payout_status := OLD.payout_status;
  NEW.payout_ref := OLD.payout_ref;
  NEW.payout_at := OLD.payout_at;
  NEW.payout_error := OLD.payout_error;
  NEW.total_amount := OLD.total_amount;
  NEW.subtotal := OLD.subtotal;
  NEW.shipping_cost := OLD.shipping_cost;
  NEW.service_fee := OLD.service_fee;
  NEW.commission_pct := OLD.commission_pct;
  NEW.commission_fcfa := OLD.commission_fcfa;
  NEW.vendeur_recoit_fcfa := OLD.vendeur_recoit_fcfa;
  NEW.buyer_id := OLD.buyer_id;
  NEW.seller_id := OLD.seller_id;
  NEW.product_price := OLD.product_price;
  NEW.buyer_service_fee := OLD.buyer_service_fee;
  NEW.seller_commission := OLD.seller_commission;
  NEW.seller_net_amount := OLD.seller_net_amount;
  NEW.pricing_plan_id := OLD.pricing_plan_id;
  NEW.commission_rate_applied := OLD.commission_rate_applied;
  NEW.lifecycle_status := OLD.lifecycle_status;
  NEW.currency := OLD.currency;

  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (status IN (
    'draft', 'pending', 'paid', 'confirmed', 'processing', 'shipped',
    'delivered', 'completed', 'cancelled', 'disputed'
  ));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT,
  ADD COLUMN IF NOT EXISTS status_change_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID,
  ADD COLUMN IF NOT EXISTS confirmed_by_buyer_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history (order_id, created_at);

CREATE OR REPLACE FUNCTION public.orders_sync_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next TEXT;
  v_prev TEXT;
BEGIN
  v_next := CASE
    WHEN NEW.status = 'cancelled' THEN 'cancelled'
    WHEN NEW.status = 'disputed' OR NEW.escrow_status = 'frozen' THEN 'disputed'
    WHEN NEW.confirmed_by_buyer_at IS NOT NULL
      OR NEW.status = 'completed'
      OR (NEW.status = 'delivered' AND NEW.escrow_status = 'released') THEN 'completed'
    WHEN NEW.status = 'delivered' THEN 'delivered'
    WHEN NEW.status IN ('shipped', 'shipping') THEN 'shipped'
    WHEN NEW.status IN ('processing', 'preparing') THEN 'processing'
    WHEN NEW.payment_status = 'paid' OR NEW.escrow_status = 'held' OR NEW.status = 'paid' THEN 'paid'
    ELSE 'pending'
  END;

  v_prev := CASE WHEN TG_OP = 'UPDATE' THEN OLD.lifecycle_status ELSE NULL END;
  NEW.lifecycle_status := v_next;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_record_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev TEXT := CASE WHEN TG_OP = 'UPDATE' THEN OLD.lifecycle_status ELSE NULL END;
BEGIN
  IF TG_OP = 'INSERT' OR v_prev IS DISTINCT FROM NEW.lifecycle_status THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, reason)
    VALUES (
      NEW.id,
      v_prev,
      NEW.lifecycle_status,
      NEW.status_changed_by,
      NULLIF(BTRIM(COALESCE(NEW.status_change_reason, '')), '')
    );

    IF TG_OP = 'UPDATE' AND NEW.buyer_id IS NOT NULL AND NEW.seller_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, body, link, is_read, read)
      VALUES
        (NEW.buyer_id, 'order', 'Commande mise à jour',
         'Votre commande passe à : ' || NEW.lifecycle_status, NEW.lifecycle_status, '/dashboard/commandes', FALSE, FALSE),
        (NEW.seller_id, 'order', 'Commande mise à jour',
         'Une commande passe à : ' || NEW.lifecycle_status, NEW.lifecycle_status, '/dashboard/commandes', FALSE, FALSE);
    END IF;

    UPDATE public.orders
    SET status_change_reason = NULL, status_changed_by = NULL
    WHERE id = NEW.id
      AND (status_change_reason IS NOT NULL OR status_changed_by IS NOT NULL);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_sync_lifecycle ON public.orders;
CREATE TRIGGER trg_orders_sync_lifecycle
  BEFORE INSERT OR UPDATE OF status, payment_status, escrow_status, confirmed_by_buyer_at
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_sync_lifecycle();

DROP TRIGGER IF EXISTS trg_orders_record_lifecycle ON public.orders;
CREATE TRIGGER trg_orders_record_lifecycle
  AFTER INSERT OR UPDATE OF status, payment_status, escrow_status, confirmed_by_buyer_at
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_record_lifecycle();

ALTER TABLE public.orders DISABLE TRIGGER trg_protect_order_privileged;
ALTER TABLE public.orders DISABLE TRIGGER trg_orders_sync_lifecycle;
UPDATE public.orders
SET lifecycle_status = CASE
  WHEN status = 'cancelled' THEN 'cancelled'
  WHEN status = 'disputed' OR escrow_status = 'frozen' THEN 'disputed'
  WHEN confirmed_by_buyer_at IS NOT NULL
    OR status = 'completed'
    OR (status = 'delivered' AND escrow_status = 'released') THEN 'completed'
  WHEN status = 'delivered' THEN 'delivered'
  WHEN status IN ('shipped', 'shipping') THEN 'shipped'
  WHEN status IN ('processing', 'preparing') THEN 'processing'
  WHEN payment_status = 'paid' OR escrow_status = 'held' OR status = 'paid' THEN 'paid'
  ELSE 'pending'
END;

INSERT INTO public.order_status_history (order_id, from_status, to_status, reason)
SELECT id, NULL, lifecycle_status, 'Reprise du cycle existant'
FROM public.orders
WHERE lifecycle_status IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.order_status_history h WHERE h.order_id = orders.id
  );

ALTER TABLE public.orders ENABLE TRIGGER trg_orders_sync_lifecycle;
ALTER TABLE public.orders ENABLE TRIGGER trg_protect_order_privileged;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_status_history_select_party ON public.order_status_history;
CREATE POLICY order_status_history_select_party
  ON public.order_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

COMMENT ON TABLE public.order_status_history IS
  'Historique atomique du cycle de vie. Écrit par le trigger orders_sync_lifecycle.';
