-- 079 — Module 5 : file d'événements SCG alimentée atomiquement par trigger. Idempotent.

CREATE TABLE IF NOT EXISTS public.scg_events_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS scg_events_queue_once
  ON public.scg_events_queue (user_id, event_type, ((payload->>'order_id')));

ALTER TABLE public.scg_events_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scg_events_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scg_events_queue TO service_role;

CREATE OR REPLACE FUNCTION public.orders_enqueue_scg_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    INSERT INTO public.scg_events_queue (user_id, event_type, payload)
    VALUES
      (NEW.seller_id, 'order_delivered', jsonb_build_object('order_id', NEW.id, 'role', 'seller')),
      (NEW.buyer_id,  'order_delivered', jsonb_build_object('order_id', NEW.id, 'role', 'buyer'))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_enqueue_scg ON public.orders;
CREATE TRIGGER trg_orders_enqueue_scg
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_enqueue_scg_on_delivery();
