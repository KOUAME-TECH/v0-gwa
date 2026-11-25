-- Rollback de 078_security_modules.sql.
-- À encadrer par BEGIN/ROLLBACK ou BEGIN/COMMIT selon le go.
-- Restaure messages_update_participant (066) et l'ancienne fonction trigger 065
-- (sans le verrou payment_reference ajouté par 078).

BEGIN;

DROP POLICY IF EXISTS "messages_update_own_unread" ON public.messages;
DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
CREATE POLICY "messages_update_participant"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.participant_1 = (SELECT auth.uid())
          OR c.participant_2 = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.participant_1 = (SELECT auth.uid())
          OR c.participant_2 = (SELECT auth.uid())
        )
    )
  );

DROP FUNCTION IF EXISTS public.mark_messages_read(uuid);

DROP TABLE IF EXISTS public.scg_events_queue;

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
  NEW.payout_network := OLD.payout_network;
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
  NEW.provider_reference := OLD.provider_reference;

  BEGIN
    NEW.payout_fee_frozen_fcfa := OLD.payout_fee_frozen_fcfa;
    NEW.payout_plan_id_at_payment := OLD.payout_plan_id_at_payment;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
