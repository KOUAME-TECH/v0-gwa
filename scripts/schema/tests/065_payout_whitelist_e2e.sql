-- T065 — bout en bout LOCAL (073/074 + 077 #49 modèle b + 065 liste blanche + 079).
-- ROLLBACK : n'écrit rien. Pas de bouchon : gwa_quote_pricing et gwa_payout_fee réelles.
--
-- Origine du 7 % : le vendeur témoin du clone (24a869e6-…) est sur Récolte (PRO, 0.07,
-- payout_included=99), grille du 5/11 (073) aussi en prod. Ce n'est pas Graine (FREE, 0.09).
-- Libération (077) : pas de REVENUE_GWA_PAYOUT. Récolte WALLET_SELLER=930 ; Graine=910.
-- Versement (079) : frais une fois par versement si le quota (décompté en versements payés) est épuisé.
--   Graine : WALLET 0, REVENUE_GWA_PAYOUT 300, 610 sortis (TREASURY_GWA).
--   Récolte, quota inclus : frais 0, 930 sortis, aucune ligne REVENUE_GWA_PAYOUT.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
DECLARE
  v_seller uuid; v_buyer uuid; v_graine uuid; v_plan_r uuid; v_plan_g uuid;
  oA uuid; oB uuid; oC uuid; oX uuid; oG uuid; oG2 uuid;
  r jsonb; q jsonb; b record;
  v_fee int; v_net int; v_com int; v_bf int; v_brut int;
  v_fee_g int; v_net_g int; v_com_g int; v_bf_g int; v_brut_g int;
BEGIN
  IF to_regprocedure('public.gwa_payout_fee(uuid,uuid)') IS NULL
     AND to_regprocedure('public.gwa_payout_fee(uuid)') IS NULL THEN
    RAISE EXCEPTION 'T065 : gwa_payout_fee absente';
  END IF;
  IF to_regprocedure('public.gwa_quote_pricing(uuid,numeric,uuid)') IS NULL THEN
    RAISE EXCEPTION 'T065 : gwa_quote_pricing absente';
  END IF;
  IF to_regprocedure('public.gwa_post_release_split(uuid,integer,integer,integer,integer,text,text,text,text,timestamptz,text,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'T065 : gwa_post_release_split absente';
  END IF;
  IF to_regprocedure('public.admin_update_manual_payout(uuid,text,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'T065 : admin_update_manual_payout absente (079 requise)';
  END IF;

  SELECT id INTO v_plan_r FROM public.pricing_plans WHERE code = 'PRO' AND is_active IS TRUE;
  SELECT id INTO v_plan_g FROM public.pricing_plans WHERE code = 'FREE' AND is_active IS TRUE;
  IF (SELECT commission_rate FROM public.pricing_plans WHERE id = v_plan_r) <> 0.07
     OR (SELECT commission_rate FROM public.pricing_plans WHERE id = v_plan_g) <> 0.09
     OR (SELECT payout_included FROM public.pricing_plans WHERE id = v_plan_g) <> 0 THEN
    RAISE EXCEPTION 'T065 : grilles Récolte/Graine hors cible';
  END IF;

  SELECT id INTO v_seller FROM public.profiles WHERE pricing_plan_id = v_plan_r ORDER BY id LIMIT 1;
  SELECT id INTO v_buyer FROM public.profiles WHERE id <> v_seller ORDER BY id LIMIT 1;
  UPDATE public.profiles SET pricing_plan_id = v_plan_r WHERE id = v_seller;

  v_graine := 'aaaaaaaa-0000-4000-8000-000000000065';
  INSERT INTO auth.users(id) VALUES (v_graine) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles(id, full_name, user_type, sub_type, subscription_tier, pricing_plan_id, profile_completion_pct)
  VALUES (v_graine, 'T065-GRAINE', 'producteur', 'producteur_individuel', 'free', v_plan_g, 10)
  ON CONFLICT (id) DO UPDATE SET pricing_plan_id = EXCLUDED.pricing_plan_id, subscription_tier = 'free';

  q := public.gwa_quote_pricing(v_seller, 1000, NULL);
  v_com := (q->>'seller_commission')::int;
  v_bf := (q->>'buyer_service_fee')::int;
  v_brut := (q->>'total_amount')::int;
  v_net := (q->>'seller_net_amount')::int; -- 930, frais non déduits à la libération
  v_fee := 0;

  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount)
  VALUES ('T065-A-CONFIRM-RELEASE', v_buyer, v_seller, 1000, 1000) RETURNING id INTO oA;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount)
  VALUES ('T065-B-DISPUTE-NULL', v_buyer, v_seller, 1000, 1000) RETURNING id INTO oB;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount)
  VALUES ('T065-C-LEDGER-FAIL', v_buyer, v_seller, 1000, 1000) RETURNING id INTO oC;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount, status, payment_status, escrow_status, payout_status)
  VALUES ('T065-X-CANCELLED', v_buyer, v_seller, 1000, 1000, 'delivered', 'paid', 'released', 'cancelled') RETURNING id INTO oX;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount)
  VALUES ('T065-G-GRAINE-FEE', v_buyer, v_graine, 1000, 1000) RETURNING id INTO oG;
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount)
  VALUES ('T065-G2-GRAINE-MULTI', v_buyer, v_graine, 1000, 1000) RETURNING id INTO oG2;

  IF EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.pricing_plans p ON p.id = o.pricing_plan_id
    WHERE o.id IN (oA, oB, oC, oX, oG, oG2)
      AND o.commission_rate_applied IS DISTINCT FROM p.commission_rate
  ) THEN
    RAISE EXCEPTION 'T065 : commission_rate_applied ≠ taux de pricing_plans';
  END IF;
  IF (SELECT commission_rate_applied FROM public.orders WHERE id = oA) IS DISTINCT FROM 0.07 THEN
    RAISE EXCEPTION 'T065 A : taux Récolte (7 %%) attendu';
  END IF;
  IF (SELECT commission_rate_applied FROM public.orders WHERE id = oG) IS DISTINCT FROM 0.09 THEN
    RAISE EXCEPTION 'T065 G : taux Graine (9 %%) attendu';
  END IF;

  UPDATE public.orders SET payment_status = 'paid', escrow_status = 'held' WHERE id IN (oA, oB, oC, oG, oG2);
  PERFORM public.gwa_record_ledger_entry(o, 'GATEWAY_GENIUSPAY', 'ESCROW_GWA', v_brut, 'XOF')
    FROM unnest(ARRAY[oA, oB, oC, oG, oG2]) o;

  r := public.gwa_post_release_split(oA, v_net, v_com, v_bf, v_fee, 'XOF', 'confirm', 'held', 'delivered', now(), 'pending_ops', NULL);
  r := public.gwa_post_release_split(oA, v_net, v_com, v_bf, v_fee, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  UPDATE public.orders SET escrow_status = 'frozen' WHERE id = oB;
  r := public.gwa_post_release_split(oB, v_net, v_com, v_bf, v_fee, 'XOF', 'dispute_release', 'released', 'delivered', NULL, NULL, NULL);

  -- confirm/release d'une commande disputed doit échouer (C3 QA)
  UPDATE public.orders SET status = 'disputed' WHERE id = oC;
  BEGIN
    r := public.gwa_post_release_split(oC, v_net, v_com, v_bf, v_fee, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
    RAISE EXCEPTION 'T065 : release d''une commande disputed aurait dû échouer';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%escrow_not_held%' THEN RAISE; END IF;
  END;
  UPDATE public.orders SET status = 'pending' WHERE id = oC; -- rétablit pour le cas C plus bas

  FOR b IN
    SELECT o.order_number, o.status, o.escrow_status, o.payout_status,
      sum(CASE WHEN l.account_credit='ESCROW_GWA' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='ESCROW_GWA' THEN l.amount ELSE 0 END) esc,
      sum(CASE WHEN l.account_credit='WALLET_SELLER' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='WALLET_SELLER' THEN l.amount ELSE 0 END) ws,
      sum(CASE WHEN l.account_credit='REVENUE_GWA' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='REVENUE_GWA' THEN l.amount ELSE 0 END) rv,
      sum(CASE WHEN l.account_credit='REVENUE_GWA_BUYER_FEE' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='REVENUE_GWA_BUYER_FEE' THEN l.amount ELSE 0 END) bf,
      sum(CASE WHEN l.account_credit='REVENUE_GWA_PAYOUT' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='REVENUE_GWA_PAYOUT' THEN l.amount ELSE 0 END) pf,
      sum(CASE WHEN l.account_credit='GATEWAY_GENIUSPAY' THEN l.amount ELSE 0 END) - sum(CASE WHEN l.account_debit='GATEWAY_GENIUSPAY' THEN l.amount ELSE 0 END) gw,
      count(*) n,
      count(*) FILTER (WHERE l.account_credit='REVENUE_GWA_PAYOUT') n_payout
    FROM public.orders o JOIN public.financial_ledger l ON l.transaction_id = o.id
    WHERE o.id IN (oA, oB) GROUP BY 1,2,3,4 ORDER BY 1
  LOOP
    RAISE NOTICE 'T065 % Récolte libération : ESCROW=% WALLET_SELLER=% REVENUE_GWA=% BUYER_FEE=% PAYOUT=% GATEWAY=% lignes=%',
      b.order_number, b.esc, b.ws, b.rv, b.bf, b.pf, b.gw, b.n;
    IF b.esc <> 0 OR b.ws <> 930 OR b.rv <> 70 OR b.bf <> 250 OR b.pf <> 0 OR b.gw <> -1250 OR b.n <> 4 OR b.n_payout <> 0 THEN
      RAISE EXCEPTION 'T065 % : soldes de libération hors cible (Récolte 930)', b.order_number;
    END IF;
    IF b.status <> 'delivered' OR b.escrow_status <> 'released' OR b.payout_status <> 'pending_ops' THEN
      RAISE EXCEPTION 'T065 % : statuts hors cible', b.order_number;
    END IF;
  END LOOP;

  q := public.gwa_quote_pricing(v_graine, 1000, NULL);
  v_fee_g := public.gwa_payout_fee(v_graine);
  v_com_g := (q->>'seller_commission')::int;
  v_bf_g := (q->>'buyer_service_fee')::int;
  v_brut_g := (q->>'total_amount')::int;
  v_net_g := (q->>'seller_net_amount')::int;
  IF v_fee_g IS DISTINCT FROM 300 OR v_com_g IS DISTINCT FROM 90 OR v_bf_g IS DISTINCT FROM 250
     OR v_brut_g IS DISTINCT FROM 1250 OR v_net_g IS DISTINCT FROM 910 THEN
    RAISE EXCEPTION 'T065 G : devis hors cible (fee=% com=% net=%)', v_fee_g, v_com_g, v_net_g;
  END IF;
  r := public.gwa_post_release_split(oG, v_net_g, v_com_g, v_bf_g, 0, 'XOF', 'confirm', 'held', 'delivered', now(), 'pending_ops', NULL);
  r := public.gwa_post_release_split(oG, v_net_g, v_com_g, v_bf_g, 0, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  r := public.gwa_post_release_split(oG2, v_net_g, v_com_g, v_bf_g, 0, 'XOF', 'confirm', 'held', 'delivered', now(), 'pending_ops', NULL);
  r := public.gwa_post_release_split(oG2, v_net_g, v_com_g, v_bf_g, 0, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  RAISE NOTICE 'T065 G devis : fee_quota=% com=% buyer=% brut=% net_liberation=%', v_fee_g, v_com_g, v_bf_g, v_brut_g, v_net_g;
END $$;

DO $$
DECLARE
  oA uuid; oB uuid; oC uuid; oX uuid; oG uuid; oG2 uuid; oG3 uuid;
  v_seller uuid; v_graine uuid; v_buyer uuid;
  v_net int; v_com int; v_bf int; v_fee int; v_net_g int; v_com_g int; v_bf_g int;
  act_proc uuid := 'eeeeeeee-0000-4000-8000-00000000000e';
  act_paid uuid := 'ffffffff-0000-4000-8000-00000000000f';
  pay_g uuid; pay_r uuid; pay_m uuid; pay_bad uuid;
  n_before int; ok boolean; r jsonb;
  esc int; ws int; rv int; bf int; pf int; n int; tre int; n_payout int;
  elig numeric;
BEGIN
  SELECT id, seller_id INTO oA, v_seller FROM public.orders WHERE order_number='T065-A-CONFIRM-RELEASE';
  SELECT id INTO oB FROM public.orders WHERE order_number='T065-B-DISPUTE-NULL';
  SELECT id INTO oC FROM public.orders WHERE order_number='T065-C-LEDGER-FAIL';
  SELECT id INTO oX FROM public.orders WHERE order_number='T065-X-CANCELLED';
  SELECT id, seller_id, buyer_id INTO oG, v_graine, v_buyer FROM public.orders WHERE order_number='T065-G-GRAINE-FEE';
  SELECT id INTO oG2 FROM public.orders WHERE order_number='T065-G2-GRAINE-MULTI';
  v_com := (SELECT commission_fcfa FROM public.orders WHERE id=oA);
  v_bf := (SELECT buyer_service_fee::int FROM public.orders WHERE id=oA);
  v_net := (SELECT vendeur_recoit_fcfa FROM public.orders WHERE id=oA);
  v_fee := 0;
  v_net_g := (SELECT vendeur_recoit_fcfa FROM public.orders WHERE id=oG);
  v_com_g := (SELECT commission_fcfa FROM public.orders WHERE id=oG);
  v_bf_g := (SELECT buyer_service_fee::int FROM public.orders WHERE id=oG);

  SELECT
    sum(CASE WHEN account_credit='ESCROW_GWA' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='ESCROW_GWA' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='WALLET_SELLER' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='WALLET_SELLER' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='REVENUE_GWA' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='REVENUE_GWA' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='REVENUE_GWA_BUYER_FEE' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='REVENUE_GWA_BUYER_FEE' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='REVENUE_GWA_PAYOUT' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='REVENUE_GWA_PAYOUT' THEN amount ELSE 0 END),
    count(*)::int
  INTO esc, ws, rv, bf, pf, n
  FROM public.financial_ledger WHERE transaction_id = oG;
  RAISE NOTICE 'T065 G Graine libération : ESCROW=% WALLET_SELLER=% REVENUE_GWA=% BUYER_FEE=% PAYOUT=% lignes=%', esc, ws, rv, bf, pf, n;
  IF esc <> 0 OR ws <> 910 OR rv <> 90 OR bf <> 250 OR pf <> 0 OR n <> 4 THEN
    RAISE EXCEPTION 'T065 G : soldes de libération hors cible (attendu WALLET 910, pas de PAYOUT)';
  END IF;

  elig := public.get_seller_eligible_proceeds(v_graine);
  IF elig IS DISTINCT FROM 1820 THEN
    RAISE EXCEPTION 'T065 N2 : proceeds Graine = % (attendu 1820, pas 1220)', elig;
  END IF;
  IF (SELECT amount_fcfa FROM public.gwa_payout_eligible_orders(v_graine) WHERE order_id = oG) IS DISTINCT FROM 910 THEN
    RAISE EXCEPTION 'T065 N2 : éligible G hors 910';
  END IF;
  RAISE NOTICE 'T065 N2 OK : proceeds Graine 1820 (2×910), frais 300 non déduits avant le versement';

  INSERT INTO auth.users(id) VALUES (act_proc), (act_paid) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles(id, full_name, user_type, profile_completion_pct)
  VALUES (act_proc, 'T065-PROC', 'acheteur', 10), (act_paid, 'T065-PAID', 'acheteur', 10)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.admin_roles(user_id, role, is_active)
  VALUES (act_proc, 'finance_admin', true), (act_paid, 'admin', true)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;

  ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_fcfa_check;

  -- Récolte, versement inclus : frais 0, 930 sortis
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_seller, 930, '0700000000', 'orange_ci', 'pending') RETURNING id INTO pay_r;
  r := public.admin_update_manual_payout(pay_r, 'processing', NULL, NULL, act_proc);
  r := public.admin_update_manual_payout(pay_r, 'paid', 'REF-RECOLTE-930', NULL, act_paid);
  SELECT
    sum(CASE WHEN account_credit='WALLET_SELLER' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='WALLET_SELLER' THEN amount ELSE 0 END),
    coalesce(sum(CASE WHEN account_credit='REVENUE_GWA_PAYOUT' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN account_credit='TREASURY_GWA' THEN amount ELSE 0 END), 0),
    count(*) FILTER (WHERE account_credit='REVENUE_GWA_PAYOUT')
  INTO ws, pf, tre, n_payout
  FROM public.financial_ledger WHERE transaction_id = oA OR payout_id = pay_r;
  RAISE NOTICE 'T065 Récolte versement : cycle WALLET=% PAYOUT=% TREASURY=% n_payout=%', ws, pf, tre, n_payout;
  IF ws <> 0 OR pf <> 0 OR tre <> 930 OR n_payout <> 0 THEN
    RAISE EXCEPTION 'T065 Récolte versement hors cible (930 sortis, frais 0)';
  END IF;

  -- Graine, une commande : 910 → frais 300, 610 sortis, WALLET 0
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_graine, 910, '0700000001', 'orange_ci', 'pending') RETURNING id INTO pay_g;
  r := public.admin_update_manual_payout(pay_g, 'processing', NULL, NULL, act_proc);
  r := public.admin_update_manual_payout(pay_g, 'paid', 'REF-GRAINE-910', NULL, act_paid);
  SELECT
    sum(CASE WHEN account_credit='WALLET_SELLER' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='WALLET_SELLER' THEN amount ELSE 0 END),
    coalesce(sum(CASE WHEN account_credit='REVENUE_GWA_PAYOUT' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN account_credit='TREASURY_GWA' THEN amount ELSE 0 END), 0)
  INTO ws, pf, tre
  FROM public.financial_ledger WHERE transaction_id = oG OR payout_id = pay_g;
  RAISE NOTICE 'T065 G Graine versement : cycle WALLET=% PAYOUT=% TREASURY=%', ws, pf, tre;
  IF ws <> 0 OR pf <> 300 OR tre <> 610 THEN
    RAISE EXCEPTION 'T065 G versement hors cible (attendu WS 0, PAYOUT 300, 610 sortis)';
  END IF;

  -- Multi-commandes : G3 + G2 dans un seul versement de 1820, frais 300 une seule fois
  UPDATE public.orders SET payment_status = 'paid', escrow_status = 'held'
  WHERE order_number = 'T065-G3-GRAINE-MULTI'; -- may not exist yet
  INSERT INTO public.orders(order_number, buyer_id, seller_id, subtotal, total_amount)
  VALUES ('T065-G3-GRAINE-MULTI', v_buyer, v_graine, 1000, 1000)
  ON CONFLICT (order_number) DO UPDATE SET subtotal = 1000
  RETURNING id INTO oG3;
  UPDATE public.orders SET payment_status = 'paid', escrow_status = 'held' WHERE id = oG3;
  PERFORM public.gwa_record_ledger_entry(oG3, 'GATEWAY_GENIUSPAY', 'ESCROW_GWA', 1250, 'XOF');
  r := public.gwa_post_release_split(oG3, v_net_g, v_com_g, v_bf_g, 0, 'XOF', 'confirm', 'held', 'delivered', now(), 'pending_ops', NULL);
  r := public.gwa_post_release_split(oG3, v_net_g, v_com_g, v_bf_g, 0, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_graine, 1820, '0700000002', 'orange_ci', 'pending') RETURNING id INTO pay_m;
  r := public.admin_update_manual_payout(pay_m, 'processing', NULL, NULL, act_proc);
  r := public.admin_update_manual_payout(pay_m, 'paid', 'REF-GRAINE-1820', NULL, act_paid);
  SELECT
    coalesce(sum(CASE WHEN account_credit='REVENUE_GWA_PAYOUT' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN account_credit='TREASURY_GWA' THEN amount ELSE 0 END), 0),
    count(*) FILTER (WHERE account_credit='REVENUE_GWA_PAYOUT')
  INTO pf, tre, n_payout
  FROM public.financial_ledger WHERE payout_id = pay_m;
  RAISE NOTICE 'T065 multi-commandes : PAYOUT=% TREASURY=% n_payout=% (frais une fois sur 1820)', pf, tre, n_payout;
  IF pf <> 300 OR tre <> 1520 OR n_payout <> 1 THEN
    RAISE EXCEPTION 'T065 : frais non uniques sur un versement multi-commandes';
  END IF;

  -- Négatifs
  -- rejeu
  n_before := (SELECT count(*) FROM public.financial_ledger WHERE payout_id = pay_g);
  ok := false;
  BEGIN
    r := public.admin_update_manual_payout(pay_g, 'paid', 'REF-GRAINE-910-REPLAY', NULL, act_paid);
  EXCEPTION WHEN others THEN
    ok := true;
    RAISE NOTICE 'T065 rejeu : refusé (%)', SQLERRM;
  END;
  IF NOT ok OR (SELECT count(*) FROM public.financial_ledger WHERE payout_id = pay_g) <> n_before THEN
    RAISE EXCEPTION 'T065 : rejeu non refusé ou lignes ajoutées';
  END IF;

  -- payout_ref manquant
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_seller, 930, '0700000003', 'orange_ci', 'pending') RETURNING id INTO pay_bad;
  r := public.admin_update_manual_payout(pay_bad, 'processing', NULL, NULL, act_proc);
  ok := false;
  BEGIN
    r := public.admin_update_manual_payout(pay_bad, 'paid', '', NULL, act_paid);
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%payout reference required%';
    RAISE NOTICE 'T065 payout_ref manquant : %', SQLERRM;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'T065 : payout_ref manquant non refusé'; END IF;

  -- versement 300 F avec frais (Graine)
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_graine, 300, '0700000004', 'orange_ci', 'pending') RETURNING id INTO pay_bad;
  r := public.admin_update_manual_payout(pay_bad, 'processing', NULL, NULL, act_proc);
  ok := false;
  BEGIN
    r := public.admin_update_manual_payout(pay_bad, 'paid', 'REF-TOO-SMALL', NULL, act_paid);
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%payout amount too low%' OR SQLERRM LIKE '%exceeds wallet balance%';
    RAISE NOTICE 'T065 versement 300 F : %', SQLERRM;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'T065 : versement de 300 F avec frais non refusé'; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE payout_id = pay_bad) THEN
    RAISE EXCEPTION 'T065 : écritures pour un versement de 300 F refusé';
  END IF;

  -- même acteur
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_seller, 930, '0700000005', 'orange_ci', 'pending') RETURNING id INTO pay_bad;
  r := public.admin_update_manual_payout(pay_bad, 'processing', NULL, NULL, act_proc);
  ok := false;
  BEGIN
    r := public.admin_update_manual_payout(pay_bad, 'paid', 'REF-SAME-ACTOR', NULL, act_proc);
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%must differ%';
    RAISE NOTICE 'T065 même acteur : %', SQLERRM;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'T065 : même acteur non refusé'; END IF;

  -- C : écriture du grand livre en échec
  CREATE TEMP TABLE _t065_fail(tx uuid) ON COMMIT DROP; INSERT INTO _t065_fail VALUES (oC);
  CREATE FUNCTION pg_temp.t065_fail() RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN IF NEW.transaction_id IN (SELECT tx FROM _t065_fail) AND NEW.account_debit = 'ESCROW_GWA' THEN RAISE EXCEPTION 'T065 écriture refusée'; END IF; RETURN NEW; END $f$;
  CREATE TRIGGER t065_fail BEFORE INSERT ON public.financial_ledger FOR EACH ROW EXECUTE FUNCTION pg_temp.t065_fail();
  ok := false;
  BEGIN
    r := public.gwa_post_release_split(oC, v_net, v_com, v_bf, v_fee, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  EXCEPTION WHEN others THEN ok := true; RAISE NOTICE 'T065 C : libération refusée (%)', SQLERRM;
  END;
  DROP TRIGGER t065_fail ON public.financial_ledger;
  IF NOT ok THEN RAISE EXCEPTION 'T065 C : la libération aurait dû échouer'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = oC AND escrow_status = 'held' AND payout_status IS NULL) THEN
    RAISE EXCEPTION 'T065 C : statut modifié malgré l''échec';
  END IF;
  IF (SELECT count(*) FROM public.financial_ledger WHERE transaction_id = oC) <> 1 THEN
    RAISE EXCEPTION 'T065 C : écritures partielles';
  END IF;
  RAISE NOTICE 'T065 C OK : escrow toujours held, payout NULL, 1 seule ligne (pay-in)';

  -- D : rejeu idempotent de la libération
  SELECT count(*) INTO n_before FROM public.financial_ledger WHERE transaction_id IN (oA, oB);
  ok := true;
  BEGIN
    r := public.gwa_post_release_split(oA, v_net, v_com, v_bf, v_fee, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
    ok := false;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    r := public.gwa_post_release_split(oB, v_net, v_com, v_bf, v_fee, 'XOF', 'dispute_release', 'released', 'delivered', NULL, NULL, NULL);
    ok := false;
  EXCEPTION WHEN others THEN NULL;
  END;
  IF NOT ok OR (SELECT count(*) FROM public.financial_ledger WHERE transaction_id IN (oA, oB)) <> n_before THEN
    RAISE EXCEPTION 'T065 D : rejeu non idempotent';
  END IF;
  RAISE NOTICE 'T065 D OK : rejeux refusés, lignes inchangées (%)', n_before;

  -- E : file de versement
  IF NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = oB) THEN
    RAISE EXCEPTION 'T065 E : B absent de la file';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id IN (oC, oX, 'e09af219-2831-4308-b235-b37fb6df82e8')) THEN
    RAISE EXCEPTION 'T065 E : C, X ou MW16COUJ éligible';
  END IF;
  RAISE NOTICE 'T065 E OK : B éligible ; C, X et MW16COUJ exclues';

  -- QA-2 : commande remboursée non versable
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.orders
     SET payment_status = 'refunded'
   WHERE id = oB;
  IF EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = oB) THEN
    RAISE EXCEPTION 'T065 QA-2 : B remboursée encore dans la liste blanche';
  END IF;
  -- B valait 930 ; après remboursement, proceeds Récolte ne doit plus l'inclure
  -- (A déjà versé : cycle à 0).
  IF public.get_seller_eligible_proceeds(v_seller) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'T065 QA-2 : proceeds après remboursement = % (attendu 0)', public.get_seller_eligible_proceeds(v_seller);
  END IF;
  UPDATE public.orders SET payment_status = 'paid' WHERE id = oB;
  PERFORM set_config('request.jwt.claim.role', NULL, true);
  RAISE NOTICE 'T065 QA-2 OK : commande remboursée exclue des proceeds';

  -- QA-3 : versement supérieur au solde WALLET
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_seller, 5000, '0700000006', 'orange_ci', 'pending') RETURNING id INTO pay_bad;
  r := public.admin_update_manual_payout(pay_bad, 'processing', NULL, NULL, act_proc);
  ok := false;
  BEGIN
    r := public.admin_update_manual_payout(pay_bad, 'paid', 'REF-OVER-WALLET', NULL, act_paid);
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%exceeds wallet balance%';
    RAISE NOTICE 'T065 QA-3 solde : %', SQLERRM;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'T065 QA-3 : versement > solde non refusé'; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE payout_id = pay_bad) THEN
    RAISE EXCEPTION 'T065 QA-3 : écritures pour un versement au-delà du solde';
  END IF;

  -- QA-3 course : deux demandes de 930 pour un solde B = 930 ; le 2e paid est refusé.
  -- PGlite est mono-connexion : on simule l'issue après verrou (séquentiel).
  IF position('pg_advisory_xact_lock' in pg_get_functiondef('public.admin_update_manual_payout(uuid,text,text,text,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'T065 QA-3 : verrou vendeur absent de admin_update_manual_payout';
  END IF;
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_seller, 930, '0700000007', 'orange_ci', 'pending') RETURNING id INTO pay_r;
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_seller, 930, '0700000008', 'orange_ci', 'pending') RETURNING id INTO pay_m;
  r := public.admin_update_manual_payout(pay_r, 'processing', NULL, NULL, act_proc);
  r := public.admin_update_manual_payout(pay_m, 'processing', NULL, NULL, act_proc);
  r := public.admin_update_manual_payout(pay_r, 'paid', 'REF-RACE-1', NULL, act_paid);
  ok := false;
  BEGIN
    r := public.admin_update_manual_payout(pay_m, 'paid', 'REF-RACE-2', NULL, act_paid);
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%exceeds wallet balance%';
    RAISE NOTICE 'T065 QA-3 concurrence : %', SQLERRM;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'T065 QA-3 : second versement concurrent non refusé'; END IF;
  RAISE NOTICE 'T065 QA-3 OK : solde et second versement refusés, verrou présent';

  -- QA-5 : vendeur / authenticated ne peut pas écrire une colonne protégée
  DECLARE
    v_sn numeric;
    v_sn2 numeric;
    v_fee_fr integer;
  BEGIN
    SELECT seller_net_amount, payout_fee_frozen_fcfa INTO v_sn, v_fee_fr FROM public.orders WHERE id = oA;
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    UPDATE public.orders
       SET seller_net_amount = 999999,
           payout_fee_frozen_fcfa = 0,
           buyer_service_fee = 0
     WHERE id = oA;
    PERFORM set_config('request.jwt.claim.role', NULL, true);
    SELECT seller_net_amount INTO v_sn2 FROM public.orders WHERE id = oA;
    IF v_sn2 IS DISTINCT FROM v_sn
       OR (SELECT payout_fee_frozen_fcfa FROM public.orders WHERE id = oA) IS DISTINCT FROM v_fee_fr
       OR (SELECT buyer_service_fee FROM public.orders WHERE id = oA) IS DISTINCT FROM v_bf THEN
      RAISE EXCEPTION 'T065 QA-5 : colonnes protégées modifiées par authenticated (net % → %)', v_sn, v_sn2;
    END IF;
    RAISE NOTICE 'T065 QA-5 OK : trigger protège seller_net_amount / frais figé / buyer_service_fee';
  END;

  -- QA-1 : acteur = vendeur
  INSERT INTO public.admin_roles(user_id, role, is_active)
  VALUES (v_seller, 'finance_admin', true)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true;
  INSERT INTO public.withdrawal_requests(user_id, amount_fcfa, phone, network, status)
  VALUES (v_seller, 930, '0700000009', 'orange_ci', 'pending') RETURNING id INTO pay_bad;
  ok := false;
  BEGIN
    r := public.admin_update_manual_payout(pay_bad, 'processing', NULL, NULL, v_seller);
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%must differ from seller%';
    RAISE NOTICE 'T065 QA-1 : %', SQLERRM;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'T065 QA-1 : acteur = vendeur non refusé'; END IF;
  RAISE NOTICE 'T065 QA-1 OK : le vendeur ne peut pas instruire son versement';

  -- QA-4 : suppression d'une commande payée refusée (FK ON DELETE RESTRICT)
  ok := false;
  BEGIN
    DELETE FROM public.orders WHERE id = oA;
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%financial_ledger%' OR SQLSTATE = '23503';
    RAISE NOTICE 'T065 QA-4 : %', SQLERRM;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'T065 QA-4 : suppression d''une commande payée acceptée'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = oA) THEN
    RAISE EXCEPTION 'T065 QA-4 : la commande payée a disparu';
  END IF;
  RAISE NOTICE 'T065 QA-4 OK : suppression d''une commande payée refusée';
END $$;
ROLLBACK;
