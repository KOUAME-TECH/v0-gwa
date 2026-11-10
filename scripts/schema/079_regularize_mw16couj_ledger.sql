-- Régularisation comptable de GWA-MW16COUJ.
-- 500 F payés, commission 30 F, net vendeur 470 F.
-- La table financial_ledger stocke chaque mouvement en une ligne débit ET crédit.
-- Les six jambes demandées deviennent donc trois écritures équilibrées :
--   1-2  Débit ACHETEUR 500        / Crédit SEQUESTRE 500
--   3-4  Débit SEQUESTRE 470       / Crédit VENDEUR 470
--   5-6  Débit SEQUESTRE 30        / Crédit COMMISSION_GWA 30
-- Ce script fige le séquestre et le versement à released.
-- Il n'appelle pas GeniusPay : c'est une écriture de livre, pas un virement opérateur.

BEGIN;

DO $$
DECLARE
  v_order_id uuid;
  v_debits bigint;
  v_credits bigint;
  v_escrow_credit bigint;
  v_escrow_debit bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  SELECT id INTO v_order_id
  FROM public.orders
  WHERE order_number = 'GWA-MW16COUJ'
    AND payment_status = 'paid'
    AND total_amount = 500
    AND commission_fcfa = 30
    AND vendeur_recoit_fcfa = 470;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'GWA-MW16COUJ ne correspond pas à 500 / 30 / 470. Écriture annulée.';
  END IF;

  UPDATE public.orders
  SET escrow_status = 'released',
      payout_status = 'released',
      payout_at = COALESCE(payout_at, now()),
      updated_at = now()
  WHERE id = v_order_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = v_order_id
      AND escrow_status = 'released'
      AND payout_status = 'released'
  ) THEN
    RAISE EXCEPTION 'Le statut released n''a pas été enregistré. Écriture annulée.';
  END IF;

  INSERT INTO public.financial_ledger (transaction_id, account_debit, account_credit, amount, currency)
  VALUES
    (v_order_id, 'ACHETEUR', 'SEQUESTRE', 500, 'XOF'),
    (v_order_id, 'SEQUESTRE', 'VENDEUR', 470, 'XOF'),
    (v_order_id, 'SEQUESTRE', 'COMMISSION_GWA', 30, 'XOF')
  ON CONFLICT (transaction_id, account_debit, account_credit) DO NOTHING;

  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount), 0)
  INTO v_debits, v_credits
  FROM public.financial_ledger
  WHERE transaction_id = v_order_id;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE account_credit = 'SEQUESTRE'), 0),
    COALESCE(SUM(amount) FILTER (WHERE account_debit = 'SEQUESTRE'), 0)
  INTO v_escrow_credit, v_escrow_debit
  FROM public.financial_ledger
  WHERE transaction_id = v_order_id;

  IF v_debits <> v_credits OR v_debits <> 1000 THEN
    RAISE EXCEPTION 'Livre déséquilibré : débits % crédits %', v_debits, v_credits;
  END IF;

  IF v_escrow_credit <> 500 OR v_escrow_debit <> 500 THEN
    RAISE EXCEPTION 'Séquestre non soldé : crédit % débit %', v_escrow_credit, v_escrow_debit;
  END IF;

  IF (
    SELECT COALESCE(SUM(amount) FILTER (WHERE account_credit = 'VENDEUR'), 0)
         + COALESCE(SUM(amount) FILTER (WHERE account_credit = 'COMMISSION_GWA'), 0)
    FROM public.financial_ledger
    WHERE transaction_id = v_order_id
  ) <> 500 THEN
    RAISE EXCEPTION 'Vendeur + commission ne reconstituent pas les 500 F.';
  END IF;
END $$;

COMMIT;
