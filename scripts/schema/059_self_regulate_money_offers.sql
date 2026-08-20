-- 059 — Self-regulate money + offers (anti double cash-out / forged accept)

-- 1) Freeze payout_* on client/admin JWT (service_role only)
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
  -- Seul service_role peut muter l'argent / payout
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
  NEW.feexpay_ref := OLD.feexpay_ref;

  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Offers: clients cannot UPDATE offer messages (only service_role via /api/offers/respond)
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND coalesce(message_type, 'text') <> 'offer'
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND coalesce(message_type, 'text') <> 'offer'
  );

-- 3) One open withdrawal per user (correct table)
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_one_open_per_user
  ON public.withdrawal_requests (user_id)
  WHERE status IN ('pending', 'processing', 'queued');
