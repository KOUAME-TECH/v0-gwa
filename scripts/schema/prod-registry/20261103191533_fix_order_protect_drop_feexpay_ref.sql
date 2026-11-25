-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261103191533 · nom « fix_order_protect_drop_feexpay_ref » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE OR REPLACE FUNCTION public.protect_order_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), auth.role());
BEGIN
  IF jwt_role = 'service_role' THEN RETURN NEW; END IF;
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
  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN NEW.status := OLD.status; END IF;
  RETURN NEW;
END; $$;
