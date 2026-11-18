-- Test 065 liste blanche, de bout en bout (clone LOCAL après 065). ROLLBACK : n'écrit rien.
-- Rejoue, en service_role comme les routes (client admin), les patchs réels :
--   webhook GeniusPay (payment paid, escrow held) → /confirm (delivered, held, pending_ops)
--   → /release (buildEscrowReleasePatch) ; et libération par litige avec payout NULL.
-- Prérequis : orders, profiles, gwa_payout_eligible_orders. Le vendeur/acheteur sont pris dans profiles.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
DECLARE v_seller uuid; v_buyer uuid; o1 uuid; o2 uuid; o3 uuid;
BEGIN
  SELECT id INTO v_seller FROM public.profiles ORDER BY id LIMIT 1;
  SELECT id INTO v_buyer FROM public.profiles WHERE id <> v_seller ORDER BY id LIMIT 1;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, vendeur_recoit_fcfa)
  VALUES ('T065-RELEASE', v_buyer, v_seller, 1000, 1000, 911) RETURNING id INTO o1;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, vendeur_recoit_fcfa)
  VALUES ('T065-DISPUTE-NULL', v_buyer, v_seller, 1000, 1000, 922) RETURNING id INTO o2;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, vendeur_recoit_fcfa)
  VALUES ('T065-CANCELLED', v_buyer, v_seller, 1000, 1000, 933) RETURNING id INTO o3;
  -- webhook paid
  UPDATE public.orders SET payment_status = 'paid', escrow_status = 'held' WHERE id IN (o1, o2, o3);
  -- /confirm (payout manuel requis) puis /release
  UPDATE public.orders SET status = 'delivered', escrow_status = 'held', payout_status = 'pending_ops', confirmed_by_buyer_at = now() WHERE id = o1;
  UPDATE public.orders SET escrow_status = 'released', status = 'delivered', payout_status = coalesce(payout_status, 'pending_ops') WHERE id = o1 AND escrow_status = 'held';
  -- litige release_seller sans /confirm préalable (payout NULL)
  UPDATE public.orders SET escrow_status = 'released', status = 'delivered', payout_status = coalesce(payout_status, 'pending_ops') WHERE id = o2;
  -- payout annulé (variante E) : ne doit jamais être éligible
  UPDATE public.orders SET escrow_status = 'released', status = 'delivered', payout_status = 'cancelled' WHERE id = o3;
  IF NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = o1) THEN RAISE EXCEPTION 'T065 : /release → absent de la file'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = o2) THEN RAISE EXCEPTION 'T065 : litige payout NULL → absent de la file'; END IF;
  IF EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = o3) THEN RAISE EXCEPTION 'T065 : payout cancelled éligible'; END IF;
  IF EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = 'e09af219-2831-4308-b235-b37fb6df82e8') THEN RAISE EXCEPTION 'T065 : MW16COUJ éligible'; END IF;
  RAISE NOTICE 'T065 OK : /release et litige (payout NULL→pending_ops) éligibles ; cancelled et MW16COUJ exclues';
END $$;
ROLLBACK;
