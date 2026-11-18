-- T065 — test de bout en bout (clone LOCAL, après 077 #49 + 065 liste blanche). ROLLBACK : n'écrit rien.
-- Chemin réel : RPC gwa_post_release_split (statut + grand livre dans la même transaction),
-- appelée comme le font /confirm, /release, confirm-delivery et le litige (client service_role).
-- Ventilation témoin : brut 1250 = net vendeur 930 + commission 70 + frais acheteur 250 + frais de versement 0.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
DECLARE
  v_seller uuid; v_buyer uuid; oA uuid; oB uuid; oC uuid; oX uuid; n_before int; ok boolean; r jsonb;
  b record;
BEGIN
  SELECT id INTO v_seller FROM public.profiles ORDER BY id LIMIT 1;
  SELECT id INTO v_buyer FROM public.profiles WHERE id <> v_seller ORDER BY id LIMIT 1;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, vendeur_recoit_fcfa, commission_fcfa, buyer_service_fee)
  VALUES ('T065-A-CONFIRM-RELEASE', v_buyer, v_seller, 1000, 1250, 930, 70, 250) RETURNING id INTO oA;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, vendeur_recoit_fcfa, commission_fcfa, buyer_service_fee)
  VALUES ('T065-B-DISPUTE-NULL', v_buyer, v_seller, 1000, 1250, 930, 70, 250) RETURNING id INTO oB;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, vendeur_recoit_fcfa, commission_fcfa, buyer_service_fee)
  VALUES ('T065-C-LEDGER-FAIL', v_buyer, v_seller, 1000, 1250, 930, 70, 250) RETURNING id INTO oC;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, vendeur_recoit_fcfa, commission_fcfa, buyer_service_fee, status, payment_status, escrow_status, payout_status)
  VALUES ('T065-X-CANCELLED', v_buyer, v_seller, 1000, 1250, 930, 70, 250, 'delivered', 'paid', 'released', 'cancelled') RETURNING id INTO oX;

  -- webhook GeniusPay : paid + held (gel du frais de versement par trigger 077) + pay-in
  UPDATE public.orders SET payment_status = 'paid', escrow_status = 'held' WHERE id IN (oA, oB, oC);
  PERFORM public.gwa_record_ledger_entry(o, 'GATEWAY_GENIUSPAY', 'ESCROW_GWA', 1250, 'XOF') FROM unnest(ARRAY[oA, oB, oC]) o;

  -- A : /confirm (payout manuel requis → held, pending_ops) puis /release
  r := public.gwa_post_release_split(oA, 930, 70, 250, 0, 'XOF', 'confirm', 'held', 'delivered', now(), 'pending_ops', NULL);
  r := public.gwa_post_release_split(oA, 930, 70, 250, 0, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  -- B : litige release_seller sans /confirm (escrow frozen, payout NULL)
  UPDATE public.orders SET escrow_status = 'frozen' WHERE id = oB;
  r := public.gwa_post_release_split(oB, 930, 70, 250, 0, 'XOF', 'dispute_release', 'released', 'delivered', NULL, NULL, NULL);

  -- Soldes crédit − débit (A et B)
  FOR b IN
    SELECT o.order_number, o.status, o.escrow_status, o.payout_status,
      sum(CASE WHEN l.account_credit='ESCROW_GWA' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='ESCROW_GWA' THEN l.amount ELSE 0 END) esc,
      sum(CASE WHEN l.account_credit='WALLET_SELLER' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='WALLET_SELLER' THEN l.amount ELSE 0 END) ws,
      sum(CASE WHEN l.account_credit='REVENUE_GWA' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='REVENUE_GWA' THEN l.amount ELSE 0 END) rv,
      sum(CASE WHEN l.account_credit='REVENUE_GWA_BUYER_FEE' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='REVENUE_GWA_BUYER_FEE' THEN l.amount ELSE 0 END) bf,
      sum(CASE WHEN l.account_credit='GATEWAY_GENIUSPAY' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='GATEWAY_GENIUSPAY' THEN l.amount ELSE 0 END) gw,
      count(*) n
    FROM public.orders o JOIN public.financial_ledger l ON l.transaction_id = o.id
    WHERE o.id IN (oA, oB) GROUP BY o.order_number, o.status, o.escrow_status, o.payout_status ORDER BY 1
  LOOP
    RAISE NOTICE 'T065 % : ESCROW_GWA=% WALLET_SELLER=% REVENUE_GWA=% REVENUE_GWA_BUYER_FEE=% GATEWAY_GENIUSPAY=% lignes=% | status=% escrow=% payout=%',
      b.order_number, b.esc, b.ws, b.rv, b.bf, b.gw, b.n, b.status, b.escrow_status, b.payout_status;
    IF b.esc <> 0 OR b.ws <> 930 OR b.rv <> 70 OR b.bf <> 250 OR b.gw <> -1250 OR b.n <> 4 THEN RAISE EXCEPTION 'T065 % : soldes hors cible', b.order_number; END IF;
    IF b.status <> 'delivered' OR b.escrow_status <> 'released' OR b.payout_status <> 'pending_ops' THEN RAISE EXCEPTION 'T065 % : statuts hors cible', b.order_number; END IF;
  END LOOP;

  -- C : écriture du grand livre en échec → la libération échoue, statut inchangé, aucune ligne de ventilation
  CREATE TEMP TABLE _t065_fail(tx uuid) ON COMMIT DROP; INSERT INTO _t065_fail VALUES (oC);
  CREATE FUNCTION pg_temp.t065_fail() RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN IF NEW.transaction_id IN (SELECT tx FROM _t065_fail) AND NEW.account_debit = 'ESCROW_GWA' THEN RAISE EXCEPTION 'T065 écriture refusée'; END IF; RETURN NEW; END $f$;
  CREATE TRIGGER t065_fail BEFORE INSERT ON public.financial_ledger FOR EACH ROW EXECUTE FUNCTION pg_temp.t065_fail();
  ok := false;
  BEGIN
    r := public.gwa_post_release_split(oC, 930, 70, 250, 0, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  EXCEPTION WHEN others THEN ok := true; RAISE NOTICE 'T065 C : libération refusée (%)', SQLERRM;
  END;
  DROP TRIGGER t065_fail ON public.financial_ledger;
  IF NOT ok THEN RAISE EXCEPTION 'T065 C : la libération aurait dû échouer'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = oC AND escrow_status = 'held' AND payout_status IS NULL) THEN RAISE EXCEPTION 'T065 C : statut modifié malgré l''échec'; END IF;
  IF (SELECT count(*) FROM public.financial_ledger WHERE transaction_id = oC) <> 1 THEN RAISE EXCEPTION 'T065 C : écritures partielles'; END IF;
  RAISE NOTICE 'T065 C OK : escrow toujours held, payout NULL, 1 seule ligne (pay-in)';

  -- D : rejeu idempotent (A rejoué en release, B rejoué en dispute_release) → refus, aucune ligne de plus
  SELECT count(*) INTO n_before FROM public.financial_ledger WHERE transaction_id IN (oA, oB);
  ok := false; BEGIN r := public.gwa_post_release_split(oA, 930, 70, 250, 0, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  EXCEPTION WHEN others THEN ok := true; END;
  BEGIN r := public.gwa_post_release_split(oB, 930, 70, 250, 0, 'XOF', 'dispute_release', 'released', 'delivered', NULL, NULL, NULL);
  ok := false; EXCEPTION WHEN others THEN NULL; END;
  IF NOT ok OR (SELECT count(*) FROM public.financial_ledger WHERE transaction_id IN (oA, oB)) <> n_before THEN RAISE EXCEPTION 'T065 D : rejeu non idempotent'; END IF;
  RAISE NOTICE 'T065 D OK : rejeux refusés (escrow_not_held), lignes inchangées (%)', n_before;

  -- E : file de versement (065 liste blanche)
  IF NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = oA)
     OR NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = oB) THEN RAISE EXCEPTION 'T065 E : A ou B absent de la file'; END IF;
  IF EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id IN (oC, oX, 'e09af219-2831-4308-b235-b37fb6df82e8')) THEN
    RAISE EXCEPTION 'T065 E : C, X (cancelled) ou MW16COUJ éligible'; END IF;
  RAISE NOTICE 'T065 E OK : A et B éligibles ; C (held), X (cancelled) et MW16COUJ exclues';
END $$;
ROLLBACK;
