-- T065 — test de bout en bout (clone LOCAL, après 073/074 + 077 #49 + 065 liste blanche). ROLLBACK : n'écrit rien.
-- Pas de bouchon : gwa_quote_pricing (073) et gwa_payout_fee (074) sont appelées telles quelles.
--
-- Origine du 7 % : l'ancien témoin figeait commission_fcfa=70 / vendeur=930, et le premier
-- profil du clone (24a869e6-…) est sur l'offre Récolte (code PRO, commission_rate=0.07,
-- payout_included=99), grille du 5/11 (073) aussi en prod. Ce n'est pas Graine (FREE, 0.09).
-- Les montants A–E viennent désormais du devis réel (Récolte : 70 / 930 / frais 0).
-- Cas Graine : commission 90, net avant frais 910, gwa_payout_fee=300, net après frais 610.
--
-- Écart versement : gwa_post_release_split (077) poste le frais à la libération
-- (Débit ESCROW_GWA / Crédit REVENUE_GWA_PAYOUT). request_manual_payout et
-- admin_update_manual_payout (065) n'écrivent pas le grand livre : pas de
-- Débit WALLET_SELLER / Crédit REVENUE_GWA_PAYOUT, ni Débit WALLET_SELLER /
-- Crédit GATEWAY_* ou TREASURY. WALLET_SELLER reste donc au net après frais.
BEGIN;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $$
DECLARE
  v_seller uuid; v_buyer uuid; v_graine uuid; v_plan_r uuid; v_plan_g uuid;
  oA uuid; oB uuid; oC uuid; oX uuid; oG uuid; n_before int; ok boolean; r jsonb;
  b record; q jsonb; v_fee int; v_net int; v_com int; v_bf int; v_brut int;
  v_fee_g int; v_net_g int; v_com_g int; v_bf_g int; v_brut_g int;
  v_src text;
BEGIN
  IF to_regprocedure('public.gwa_payout_fee(uuid)') IS NULL THEN
    RAISE EXCEPTION 'T065 : gwa_payout_fee absente (074 requise, sans bouchon)';
  END IF;
  IF to_regprocedure('public.gwa_quote_pricing(uuid,numeric,uuid)') IS NULL THEN
    RAISE EXCEPTION 'T065 : gwa_quote_pricing absente (073 requise)';
  END IF;
  IF to_regprocedure('public.gwa_post_release_split(uuid,integer,integer,integer,integer,text,text,text,text,timestamptz,text,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'T065 : gwa_post_release_split absente (077 requise)';
  END IF;

  SELECT id INTO v_plan_r FROM public.pricing_plans WHERE code = 'PRO' AND is_active IS TRUE;
  SELECT id INTO v_plan_g FROM public.pricing_plans WHERE code = 'FREE' AND is_active IS TRUE;
  IF v_plan_r IS NULL OR v_plan_g IS NULL THEN
    RAISE EXCEPTION 'T065 : offres PRO/FREE absentes';
  END IF;
  IF (SELECT commission_rate FROM public.pricing_plans WHERE id = v_plan_r) <> 0.07 THEN
    RAISE EXCEPTION 'T065 : Récolte n''est pas à 7 %%';
  END IF;
  IF (SELECT commission_rate FROM public.pricing_plans WHERE id = v_plan_g) <> 0.09
     OR (SELECT payout_included FROM public.pricing_plans WHERE id = v_plan_g) <> 0 THEN
    RAISE EXCEPTION 'T065 : Graine n''est pas à 9 %% / 0 versement inclus';
  END IF;

  -- Vendeur témoin historique : Récolte (7 %, quota 99). Acheteur distinct.
  SELECT id INTO v_seller FROM public.profiles WHERE pricing_plan_id = v_plan_r ORDER BY id LIMIT 1;
  SELECT id INTO v_buyer FROM public.profiles WHERE id <> v_seller ORDER BY id LIMIT 1;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'T065 : aucun vendeur sur l''offre Récolte';
  END IF;
  UPDATE public.profiles SET pricing_plan_id = v_plan_r WHERE id = v_seller;

  -- Vendeur Graine (9 %, 0 versement inclus) pour le cas frais 300 F
  v_graine := 'aaaaaaaa-0000-4000-8000-000000000065';
  INSERT INTO auth.users(id) VALUES (v_graine) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles(id, full_name, user_type, sub_type, subscription_tier, pricing_plan_id, profile_completion_pct)
  VALUES (v_graine, 'T065-GRAINE', 'producteur', 'producteur_individuel', 'free', v_plan_g, 10)
  ON CONFLICT (id) DO UPDATE SET pricing_plan_id = EXCLUDED.pricing_plan_id, subscription_tier = 'free';

  q := public.gwa_quote_pricing(v_seller, 1000, NULL);
  v_fee := public.gwa_payout_fee(v_seller);
  v_com := (q->>'seller_commission')::int;
  v_bf := (q->>'buyer_service_fee')::int;
  v_brut := (q->>'total_amount')::int;
  v_net := (q->>'seller_net_amount')::int - v_fee;
  IF v_net < 0 THEN RAISE EXCEPTION 'T065 : net vendeur négatif'; END IF;

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

  -- commission_rate_applied = taux de pricing_plans pour l'offre du vendeur au moment de la commande
  IF EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.pricing_plans p ON p.id = o.pricing_plan_id
    WHERE o.id IN (oA, oB, oC, oX, oG)
      AND o.commission_rate_applied IS DISTINCT FROM p.commission_rate
  ) THEN
    RAISE EXCEPTION 'T065 : commission_rate_applied ≠ taux de pricing_plans';
  END IF;
  IF (SELECT commission_rate_applied FROM public.orders WHERE id = oA) IS DISTINCT FROM 0.07
     OR (SELECT pricing_plan_id FROM public.orders WHERE id = oA) IS DISTINCT FROM v_plan_r THEN
    RAISE EXCEPTION 'T065 A : offre/taux Récolte attendus (origine du 7 %%)';
  END IF;
  IF (SELECT commission_rate_applied FROM public.orders WHERE id = oG) IS DISTINCT FROM 0.09
     OR (SELECT pricing_plan_id FROM public.orders WHERE id = oG) IS DISTINCT FROM v_plan_g THEN
    RAISE EXCEPTION 'T065 G : offre/taux Graine (9 %%) attendus';
  END IF;

  -- webhook GeniusPay : paid + held (gel du frais par trigger 077, via gwa_payout_fee réelle)
  UPDATE public.orders SET payment_status = 'paid', escrow_status = 'held' WHERE id IN (oA, oB, oC, oG);
  IF (SELECT payout_fee_frozen_fcfa FROM public.orders WHERE id = oA) IS DISTINCT FROM v_fee
     OR (SELECT payout_fee_frozen_fcfa FROM public.orders WHERE id = oG) IS DISTINCT FROM public.gwa_payout_fee(v_graine) THEN
    RAISE EXCEPTION 'T065 : payout_fee_frozen_fcfa ≠ gwa_payout_fee';
  END IF;

  PERFORM public.gwa_record_ledger_entry(o, 'GATEWAY_GENIUSPAY', 'ESCROW_GWA', v_brut, 'XOF') FROM unnest(ARRAY[oA, oB, oC]) o;

  -- A : /confirm (payout manuel requis → held, pending_ops) puis /release
  r := public.gwa_post_release_split(oA, v_net, v_com, v_bf, v_fee, 'XOF', 'confirm', 'held', 'delivered', now(), 'pending_ops', NULL);
  r := public.gwa_post_release_split(oA, v_net, v_com, v_bf, v_fee, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  -- B : litige release_seller sans /confirm (escrow frozen, payout NULL)
  UPDATE public.orders SET escrow_status = 'frozen' WHERE id = oB;
  r := public.gwa_post_release_split(oB, v_net, v_com, v_bf, v_fee, 'XOF', 'dispute_release', 'released', 'delivered', NULL, NULL, NULL);

  -- Soldes crédit − débit (A et B) : Récolte, versement inclus → frais 0, pas de ligne REVENUE_GWA_PAYOUT
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
    WHERE o.id IN (oA, oB) GROUP BY o.order_number, o.status, o.escrow_status, o.payout_status ORDER BY 1
  LOOP
    RAISE NOTICE 'T065 % Récolte : ESCROW_GWA=% WALLET_SELLER=% REVENUE_GWA=% REVENUE_GWA_BUYER_FEE=% REVENUE_GWA_PAYOUT=% GATEWAY_GENIUSPAY=% lignes=% n_payout=% | status=% escrow=% payout=% (fee=% net=%)',
      b.order_number, b.esc, b.ws, b.rv, b.bf, b.pf, b.gw, b.n, b.n_payout, b.status, b.escrow_status, b.payout_status, v_fee, v_net;
    IF b.esc <> 0 OR b.ws <> v_net OR b.rv <> v_com OR b.bf <> v_bf OR b.pf <> v_fee OR b.gw <> -v_brut THEN
      RAISE EXCEPTION 'T065 % : soldes hors cible', b.order_number;
    END IF;
    IF v_fee = 0 AND (b.n_payout <> 0 OR b.n <> 4) THEN
      RAISE EXCEPTION 'T065 % : une ligne REVENUE_GWA_PAYOUT est apparue alors que le frais est 0', b.order_number;
    END IF;
    IF b.status <> 'delivered' OR b.escrow_status <> 'released' OR b.payout_status <> 'pending_ops' THEN
      RAISE EXCEPTION 'T065 % : statuts hors cible', b.order_number;
    END IF;
  END LOOP;

  -- G : Graine, 0 versement inclus, vrai gwa_payout_fee (300)
  q := public.gwa_quote_pricing(v_graine, 1000, NULL);
  v_fee_g := public.gwa_payout_fee(v_graine);
  v_com_g := (q->>'seller_commission')::int;
  v_bf_g := (q->>'buyer_service_fee')::int;
  v_brut_g := (q->>'total_amount')::int;
  v_net_g := (q->>'seller_net_amount')::int - v_fee_g;
  IF v_fee_g IS DISTINCT FROM 300 OR v_com_g IS DISTINCT FROM 90 OR v_bf_g IS DISTINCT FROM 250
     OR v_brut_g IS DISTINCT FROM 1250 OR v_net_g IS DISTINCT FROM 610 THEN
    RAISE EXCEPTION 'T065 G : devis/frais Graine hors cible (fee=% com=% bf=% brut=% net=%)', v_fee_g, v_com_g, v_bf_g, v_brut_g, v_net_g;
  END IF;
  PERFORM public.gwa_record_ledger_entry(oG, 'GATEWAY_GENIUSPAY', 'ESCROW_GWA', v_brut_g, 'XOF');
  r := public.gwa_post_release_split(oG, v_net_g, v_com_g, v_bf_g, v_fee_g, 'XOF', 'confirm', 'held', 'delivered', now(), 'pending_ops', NULL);
  r := public.gwa_post_release_split(oG, v_net_g, v_com_g, v_bf_g, v_fee_g, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  RAISE NOTICE 'T065 G devis : fee=% com=% buyer=% brut=% net_apres_frais=%', v_fee_g, v_com_g, v_bf_g, v_brut_g, v_net_g;
END $$;

-- Bloc G dédié (soldes + écart versement), puis C/D/E. Séparé pour des compteurs typés.
DO $$
DECLARE
  oA uuid; oB uuid; oC uuid; oX uuid; oG uuid; v_seller uuid; v_graine uuid;
  v_fee int; v_net int; v_com int; v_bf int; v_brut int;
  n_before int; ok boolean; r jsonb;
  esc int; ws int; rv int; bf int; pf int; gw int; n int;
  n_escrow_payout int; n_wallet_payout int; n_wallet_out int;
  v_src text;
BEGIN
  SELECT id INTO oA FROM public.orders WHERE order_number='T065-A-CONFIRM-RELEASE';
  SELECT id INTO oB FROM public.orders WHERE order_number='T065-B-DISPUTE-NULL';
  SELECT id INTO oC FROM public.orders WHERE order_number='T065-C-LEDGER-FAIL';
  SELECT id INTO oX FROM public.orders WHERE order_number='T065-X-CANCELLED';
  SELECT id INTO oG FROM public.orders WHERE order_number='T065-G-GRAINE-FEE';
  SELECT seller_id INTO v_seller FROM public.orders WHERE id=oA;
  SELECT seller_id INTO v_graine FROM public.orders WHERE id=oG;
  v_fee := (SELECT payout_fee_frozen_fcfa FROM public.orders WHERE id=oA);
  v_com := (SELECT commission_fcfa FROM public.orders WHERE id=oA);
  v_bf := (SELECT buyer_service_fee::int FROM public.orders WHERE id=oA);
  v_brut := (SELECT total_amount::int FROM public.orders WHERE id=oA);
  v_net := (SELECT vendeur_recoit_fcfa FROM public.orders WHERE id=oA) - v_fee;

  SELECT
    sum(CASE WHEN account_credit='ESCROW_GWA' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='ESCROW_GWA' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='WALLET_SELLER' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='WALLET_SELLER' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='REVENUE_GWA' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='REVENUE_GWA' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='REVENUE_GWA_BUYER_FEE' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='REVENUE_GWA_BUYER_FEE' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='REVENUE_GWA_PAYOUT' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='REVENUE_GWA_PAYOUT' THEN amount ELSE 0 END),
    sum(CASE WHEN account_credit='GATEWAY_GENIUSPAY' THEN amount ELSE 0 END) - sum(CASE WHEN account_debit='GATEWAY_GENIUSPAY' THEN amount ELSE 0 END),
    count(*)::int,
    count(*) FILTER (WHERE account_debit='ESCROW_GWA' AND account_credit='REVENUE_GWA_PAYOUT' AND amount=300)::int,
    count(*) FILTER (WHERE account_debit='WALLET_SELLER' AND account_credit='REVENUE_GWA_PAYOUT')::int,
    count(*) FILTER (WHERE account_debit='WALLET_SELLER' AND (account_credit LIKE 'GATEWAY%' OR account_credit='TREASURY'))::int
  INTO esc, ws, rv, bf, pf, gw, n, n_escrow_payout, n_wallet_payout, n_wallet_out
  FROM public.financial_ledger WHERE transaction_id = oG;

  RAISE NOTICE 'T065 G Graine : ESCROW_GWA=% WALLET_SELLER=% REVENUE_GWA=% REVENUE_GWA_BUYER_FEE=% REVENUE_GWA_PAYOUT=% GATEWAY_GENIUSPAY=% lignes=% | ESCROW→PAYOUT300=% WALLET→PAYOUT=% WALLET→GATEWAY/TREASURY=%',
    esc, ws, rv, bf, pf, gw, n, n_escrow_payout, n_wallet_payout, n_wallet_out;
  IF esc <> 0 OR ws <> 610 OR rv <> 90 OR bf <> 250 OR pf <> 300 OR gw <> -1250 OR n <> 5 OR n_escrow_payout <> 1 THEN
    RAISE EXCEPTION 'T065 G : soldes de libération hors cible';
  END IF;
  -- Écart : le versement 065 ne poste pas WALLET_SELLER → REVENUE_GWA_PAYOUT ni WALLET_SELLER → GATEWAY/TREASURY
  IF n_wallet_payout <> 0 OR n_wallet_out <> 0 THEN
    RAISE EXCEPTION 'T065 G : écriture de versement inattendue sur WALLET_SELLER';
  END IF;
  RAISE NOTICE 'T065 G écart : frais posté à la libération (077 gwa_post_release_split, ESCROW_GWA→REVENUE_GWA_PAYOUT 300), pas au versement ; WALLET_SELLER reste 610 (pas 0) ; vendeur ne reçoit pas 630 (taux 9 %% → net 610, pas 7 %% → 630)';

  FOREACH v_src IN ARRAY ARRAY['request_manual_payout','admin_update_manual_payout']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=v_src)
       AND EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname=v_src
           AND pg_get_functiondef(p.oid) ~* 'financial_ledger|gwa_record_ledger'
       ) THEN
      RAISE EXCEPTION 'T065 : % écrit le grand livre, ce qui contredirait le constat d''écart', v_src;
    END IF;
  END LOOP;
  RAISE NOTICE 'T065 écart 065 : request_manual_payout et admin_update_manual_payout n''écrivent pas financial_ledger';

  -- C : écriture du grand livre en échec → la libération échoue, statut inchangé, aucune ligne de ventilation
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
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = oC AND escrow_status = 'held' AND payout_status IS NULL) THEN RAISE EXCEPTION 'T065 C : statut modifié malgré l''échec'; END IF;
  IF (SELECT count(*) FROM public.financial_ledger WHERE transaction_id = oC) <> 1 THEN RAISE EXCEPTION 'T065 C : écritures partielles'; END IF;
  RAISE NOTICE 'T065 C OK : escrow toujours held, payout NULL, 1 seule ligne (pay-in)';

  -- D : rejeu idempotent
  SELECT count(*) INTO n_before FROM public.financial_ledger WHERE transaction_id IN (oA, oB);
  ok := false; BEGIN r := public.gwa_post_release_split(oA, v_net, v_com, v_bf, v_fee, 'XOF', 'release', 'released', 'delivered', NULL, NULL, NULL);
  EXCEPTION WHEN others THEN ok := true; END;
  BEGIN r := public.gwa_post_release_split(oB, v_net, v_com, v_bf, v_fee, 'XOF', 'dispute_release', 'released', 'delivered', NULL, NULL, NULL);
  ok := false; EXCEPTION WHEN others THEN NULL; END;
  IF NOT ok OR (SELECT count(*) FROM public.financial_ledger WHERE transaction_id IN (oA, oB)) <> n_before THEN RAISE EXCEPTION 'T065 D : rejeu non idempotent'; END IF;
  RAISE NOTICE 'T065 D OK : rejeux refusés (escrow_not_held), lignes inchangées (%)', n_before;

  -- E : file de versement (065 liste blanche)
  IF NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = oA)
     OR NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id = oB) THEN RAISE EXCEPTION 'T065 E : A ou B absent de la file'; END IF;
  IF EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_seller) WHERE order_id IN (oC, oX, 'e09af219-2831-4308-b235-b37fb6df82e8')) THEN
    RAISE EXCEPTION 'T065 E : C, X (cancelled) ou MW16COUJ éligible';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gwa_payout_eligible_orders(v_graine) WHERE order_id = oG) THEN
    RAISE EXCEPTION 'T065 E : G (Graine, pending_ops) absente de la file';
  END IF;
  RAISE NOTICE 'T065 E OK : A, B et G éligibles ; C (held), X (cancelled) et MW16COUJ exclues';
END $$;
ROLLBACK;
