-- 079 — Grand livre du versement (modèle b : frais facturé par versement, pas par commande).
-- Pourquoi une 079 plutôt que de modifier la 065 : la 065 (liste blanche d'éligibilité,
-- request_manual_payout, transitions) est déjà revue ; y mélanger le livre et le
-- nouveau décompte du quota casserait le diff et le rollback déjà validés.
-- 079 est additive : elle remplace admin_update_manual_payout, met à jour
-- gwa_payout_fee (quota décompté par versement payé) et ajoute financial_ledger.payout_id.
-- La FK financial_ledger.transaction_id → orders (ON DELETE RESTRICT) est conservée.
--
-- Compte de sortie :
--   network = 'geniuspay' → GATEWAY_GENIUSPAY
--   network IN (orange_ci, mtn_ci, moov_ci, wave_ci) → TREASURY_GWA
-- TREASURY_GWA : compte d'attente pour un Mobile Money manuel ; sa validation
-- définitive est à confirmer par Yao. Convention des soldes : crédit − débit.
--
-- Ordre SQL : 02 → 03a → 065 (si absente de la prod) → 076 → 077 → 078 → 079.

BEGIN;

-- Gardes : échouer ici laisse le schéma intact (transaction unique).
DO $gwa079_guard$
BEGIN
  IF to_regclass('public.withdrawal_request_events') IS NULL THEN
    RAISE EXCEPTION '079: migration 065 requise (table withdrawal_request_events)';
  END IF;
  IF to_regprocedure('public.request_manual_payout(integer,text,text)') IS NULL
     AND to_regprocedure('public.get_seller_eligible_proceeds(uuid)') IS NULL
  THEN
    RAISE EXCEPTION '079: migration 065 requise (fonctions de versement manuel)';
  END IF;
  IF to_regprocedure('public.gwa_post_release_split(uuid,integer,integer,integer,integer,text,text,text,text,timestamptz,text,timestamptz)') IS NULL THEN
    RAISE EXCEPTION '079: migration 077 requise (gwa_post_release_split)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payout_fee_frozen_fcfa'
  ) THEN
    RAISE EXCEPTION '079: migration 077 requise (orders.payout_fee_frozen_fcfa)';
  END IF;
END
$gwa079_guard$;

-- payout_id distinct de transaction_id : on garde la FK vers orders (ON DELETE RESTRICT).
ALTER TABLE public.financial_ledger
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.withdrawal_requests (id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.financial_ledger.transaction_id IS
  'orders.id pour les écritures de paiement / libération (077). NULL sur une jambe de versement (079).';
COMMENT ON COLUMN public.financial_ledger.payout_id IS
  'withdrawal_requests.id pour les écritures de versement (079). NULL sur une jambe de commande.';

-- 077 a pu poser NOT NULL sur transaction_id ; une jambe de versement n'a pas de commande.
ALTER TABLE public.financial_ledger
  ALTER COLUMN transaction_id DROP NOT NULL;

ALTER TABLE public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_source_chk;
ALTER TABLE public.financial_ledger
  ADD CONSTRAINT financial_ledger_source_chk
  CHECK (
    (transaction_id IS NOT NULL AND payout_id IS NULL)
    OR (transaction_id IS NULL AND payout_id IS NOT NULL)
  );

-- Si une ancienne 079 avait retiré la FK, la rétablir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.financial_ledger'::regclass
      AND contype = 'f'
      AND confrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.financial_ledger
      ADD CONSTRAINT financial_ledger_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.orders (id) ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS public.financial_ledger_payout_leg_uidx;
CREATE UNIQUE INDEX financial_ledger_payout_leg_uidx
  ON public.financial_ledger (payout_id, account_debit, account_credit)
  WHERE payout_id IS NOT NULL
    AND account_debit = 'WALLET_SELLER'
    AND account_credit IN ('REVENUE_GWA_PAYOUT', 'GATEWAY_GENIUSPAY', 'TREASURY_GWA');

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS processing_by uuid REFERENCES public.profiles (id);

COMMENT ON COLUMN public.withdrawal_requests.processing_by IS
  'Acteur qui a passé le versement en processing. Celui qui marque payé doit être distinct.';

-- Quota décompté par versement payé du mois, pas par commande confirmée.
DROP FUNCTION IF EXISTS public.gwa_payout_fee(uuid);

CREATE OR REPLACE FUNCTION public.gwa_payout_fee(
  p_seller_id uuid,
  p_except_payout_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_included integer := 0;
  v_fee integer := 0;
  v_count integer := 0;
  v_plan_id uuid;
  v_user_type text;
BEGIN
  SELECT pricing_plan_id, user_type
    INTO v_plan_id, v_user_type
  FROM public.profiles
  WHERE id = p_seller_id;

  IF v_plan_id IS NOT NULL THEN
    SELECT COALESCE(payout_included, 0) INTO v_included
    FROM public.pricing_plans WHERE id = v_plan_id AND is_active IS TRUE;
  END IF;

  IF v_plan_id IS NULL OR v_included IS NULL THEN
    SELECT COALESCE(payout_included, 0) INTO v_included
    FROM public.pricing_plans
    WHERE code = CASE WHEN v_user_type = 'cooperative' THEN 'COOP_START' ELSE 'FREE' END
    LIMIT 1;
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::integer
    WHEN jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[0-9]+$' THEN (value #>> '{}')::integer
    ELSE 0
  END
  INTO v_fee
  FROM public.platform_settings
  WHERE key = 'payout_fee_cost';

  -- Versements déjà payés ce mois, hors le versement courant (pas encore payé).
  SELECT COUNT(*)::integer INTO v_count
  FROM public.withdrawal_requests
  WHERE user_id = p_seller_id
    AND status = 'paid'
    AND COALESCE(processed_at, updated_at, created_at) >= date_trunc('month', NOW())
    AND COALESCE(processed_at, updated_at, created_at) < date_trunc('month', NOW()) + INTERVAL '1 month'
    AND (p_except_payout_id IS NULL OR id IS DISTINCT FROM p_except_payout_id);

  IF COALESCE(v_count, 0) >= COALESCE(v_included, 0) THEN
    RETURN GREATEST(COALESCE(v_fee, 0), 0);
  END IF;
  RETURN 0;
END;
$$;

REVOKE ALL ON FUNCTION public.gwa_payout_fee(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_payout_fee(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.gwa_seller_wallet_balance(p_seller_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT SUM(CASE WHEN l.account_credit = 'WALLET_SELLER' THEN l.amount ELSE 0 END)
         - SUM(CASE WHEN l.account_debit  = 'WALLET_SELLER' THEN l.amount ELSE 0 END)
    FROM public.financial_ledger l
    WHERE l.transaction_id IN (SELECT id FROM public.orders WHERE seller_id = p_seller_id)
       OR l.payout_id IN (SELECT id FROM public.withdrawal_requests WHERE user_id = p_seller_id)
  ), 0)::integer;
$$;

REVOKE ALL ON FUNCTION public.gwa_seller_wallet_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gwa_seller_wallet_balance(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_manual_payout(
  p_request_id uuid,
  p_new_status text,
  p_payout_reference text,
  p_notes text,
  p_actor uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.withdrawal_requests%ROWTYPE;
  updated public.withdrawal_requests%ROWTYPE;
  action_name text;
  v_fee integer := 0;
  v_net integer := 0;
  v_exit text;
  v_network text;
  v_ref text;
  v_posted boolean := false;
  v_wallet integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = p_actor
      AND ar.is_active = true
      AND ar.role IN ('admin', 'super_admin', 'finance_admin')
  ) THEN
    RAISE EXCEPTION 'finance admin required';
  END IF;

  IF p_new_status NOT IN ('processing', 'paid', 'failed') THEN
    RAISE EXCEPTION 'invalid payout status';
  END IF;

  -- Verrou de la demande : statut + livre dans la même transaction.
  SELECT *
    INTO existing
    FROM public.withdrawal_requests
    WHERE id = p_request_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout request not found';
  END IF;

  -- Serialise solde et quota de frais pour tous les versements du même vendeur.
  PERFORM pg_advisory_xact_lock(hashtext(existing.user_id::text)::bigint);

  IF p_actor IS NOT DISTINCT FROM existing.user_id THEN
    RAISE EXCEPTION 'paid actor must differ from seller';
  END IF;

  IF NOT (
    (existing.status = 'pending' AND p_new_status IN ('processing', 'failed'))
    OR (existing.status = 'processing' AND p_new_status IN ('paid', 'failed'))
  ) THEN
    RAISE EXCEPTION 'invalid payout transition';
  END IF;

  IF p_new_status = 'paid' THEN
    v_ref := trim(COALESCE(p_payout_reference, existing.payout_reference, ''));
    IF length(v_ref) = 0 THEN
      RAISE EXCEPTION 'payout reference required';
    END IF;
    IF length(v_ref) > 128 THEN
      RAISE EXCEPTION 'payout reference too long';
    END IF;

    v_network := NULLIF(trim(COALESCE(existing.network, '')), '');
    IF v_network IS NULL THEN
      RAISE EXCEPTION 'payout network required';
    END IF;
    IF v_network = 'geniuspay' THEN
      v_exit := 'GATEWAY_GENIUSPAY';
    ELSIF v_network IN ('orange_ci', 'mtn_ci', 'moov_ci', 'wave_ci') THEN
      -- TREASURY_GWA : sortie Mobile Money manuelle, en attente de la validation de Yao.
      v_exit := 'TREASURY_GWA';
    ELSE
      RAISE EXCEPTION 'invalid network';
    END IF;

    IF existing.processing_by IS NULL THEN
      RAISE EXCEPTION 'processing actor required';
    END IF;
    IF p_actor IS NOT DISTINCT FROM existing.processing_by THEN
      RAISE EXCEPTION 'paid actor must differ from processing actor';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.financial_ledger WHERE payout_id = p_request_id
    ) INTO v_posted;
    IF COALESCE(v_posted, false) THEN
      RAISE EXCEPTION 'payout already posted';
    END IF;

    v_wallet := public.gwa_seller_wallet_balance(existing.user_id);
    IF existing.amount_fcfa > v_wallet THEN
      RAISE EXCEPTION 'payout amount exceeds wallet balance';
    END IF;

    -- Un versement peut couvrir plusieurs commandes ; le frais s'applique une seule fois.
    -- Le quota est lu sous le verrou vendeur (après les versements déjà commités).
    v_fee := public.gwa_payout_fee(existing.user_id, p_request_id);
    IF v_fee > 0 AND existing.amount_fcfa <= v_fee THEN
      RAISE EXCEPTION 'payout amount too low for fee';
    END IF;
    v_net := existing.amount_fcfa - COALESCE(v_fee, 0);
    IF v_net <= 0 THEN
      RAISE EXCEPTION 'payout amount too low for fee';
    END IF;

    INSERT INTO public.financial_ledger (
      transaction_id, payout_id, account_debit, account_credit, amount, currency
    )
    SELECT NULL, p_request_id, v.debit, v.credit, v.amount, 'XOF'
    FROM (
      VALUES
        ('WALLET_SELLER', 'REVENUE_GWA_PAYOUT', COALESCE(v_fee, 0)),
        ('WALLET_SELLER', v_exit, v_net)
    ) AS v(debit, credit, amount)
    WHERE v.amount > 0;
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_new_status,
      payout_reference = CASE WHEN p_new_status = 'paid' THEN v_ref ELSE payout_reference END,
      admin_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
      processing_by = CASE
        WHEN p_new_status = 'processing' THEN p_actor
        ELSE processing_by
      END,
      processed_by = p_actor,
      processed_at = CASE WHEN p_new_status IN ('paid', 'failed') THEN NOW() ELSE processed_at END,
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO updated;

  action_name := p_new_status;
  INSERT INTO public.withdrawal_request_events (
    withdrawal_request_id, actor_user_id, action, old_status, new_status,
    payout_reference, notes
  )
  VALUES (
    p_request_id, p_actor, action_name, existing.status, updated.status,
    updated.payout_reference, updated.admin_notes
  );

  RETURN to_jsonb(updated);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_manual_payout(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_manual_payout(uuid, text, text, text, uuid) TO service_role;

-- N2 / QA-2 : montant versable = solde WALLET des commandes de la liste blanche,
-- déjà net des frais postés au versement. Remboursées et litiges exclus.
CREATE OR REPLACE FUNCTION public.gwa_payout_eligible_orders(p_seller_id UUID)
RETURNS TABLE (order_id UUID, amount_fcfa NUMERIC)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT id,
         GREATEST(0, COALESCE((
           SELECT SUM(CASE WHEN l.account_credit = 'WALLET_SELLER' THEN l.amount ELSE 0 END)
                - SUM(CASE WHEN l.account_debit  = 'WALLET_SELLER' THEN l.amount ELSE 0 END)
           FROM public.financial_ledger l
           WHERE l.transaction_id = orders.id
         ), 0))
  FROM public.orders
  WHERE seller_id = p_seller_id
    AND payment_status = 'paid'
    AND payment_status IS DISTINCT FROM 'refunded'
    AND status = 'delivered'
    AND status IS DISTINCT FROM 'disputed'
    AND escrow_status = 'released'
    AND escrow_status IS DISTINCT FROM 'disputed'
    AND payout_status IN ('pending_ops', 'failed', 'skipped_no_provider')
    AND id <> ALL (ARRAY['e09af219-2831-4308-b235-b37fb6df82e8']::uuid[]);
$$;

REVOKE ALL ON FUNCTION public.gwa_payout_eligible_orders(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_seller_eligible_proceeds(p_seller_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT GREATEST(0, COALESCE((
    SELECT SUM(CASE WHEN l.account_credit = 'WALLET_SELLER' THEN l.amount ELSE 0 END)
         - SUM(CASE WHEN l.account_debit  = 'WALLET_SELLER' THEN l.amount ELSE 0 END)
    FROM public.financial_ledger l
    WHERE l.transaction_id IN (SELECT order_id FROM public.gwa_payout_eligible_orders(p_seller_id))
       OR l.payout_id IN (SELECT id FROM public.withdrawal_requests WHERE user_id = p_seller_id)
  ), 0));
$$;

REVOKE ALL ON FUNCTION public.get_seller_eligible_proceeds(UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
