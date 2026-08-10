-- 062 — Money INSERT hardening + products SELECT + factoring uniqueness

-- 1) Orders: zero money fields on client INSERT (API must use service_role)
CREATE OR REPLACE FUNCTION public.protect_order_insert_privileged()
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

  NEW.payment_status := 'pending';
  NEW.escrow_status := 'pending';
  NEW.payout_status := NULL;
  NEW.payout_ref := NULL;
  NEW.payout_at := NULL;
  NEW.payout_error := NULL;
  NEW.feexpay_ref := NULL;
  NEW.status := coalesce(NEW.status, 'pending');
  IF NEW.status NOT IN ('pending', 'draft') THEN
    NEW.status := 'pending';
  END IF;

  -- Anti two-account fraud: client cannot set payable amounts
  NEW.total_amount := 0;
  NEW.subtotal := 0;
  NEW.shipping_cost := 0;
  NEW.service_fee := 0;
  NEW.commission_pct := 0;
  NEW.commission_fcfa := 0;
  NEW.vendeur_recoit_fcfa := 0;

  RETURN NEW;
END;
$$;

-- 2) Withdrawals: service_role only (API /api/wallet/withdraw)
CREATE OR REPLACE FUNCTION public.protect_withdrawal_insert()
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
  RAISE EXCEPTION 'withdrawal_insert_service_only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_withdrawal_insert ON public.withdrawal_requests;
CREATE TRIGGER trg_protect_withdrawal_insert
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_withdrawal_insert();

REVOKE INSERT ON public.withdrawal_requests FROM authenticated, anon;

-- 3) Factoring: service_role only (API /api/factoring)
CREATE OR REPLACE FUNCTION public.protect_factoring_insert()
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
  RAISE EXCEPTION 'factoring_insert_service_only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_factoring_insert ON public.factoring_requests;
CREATE TRIGGER trg_protect_factoring_insert
  BEFORE INSERT ON public.factoring_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_factoring_insert();

REVOKE INSERT ON public.factoring_requests FROM authenticated, anon;

-- 4) One open factoring request per order
CREATE UNIQUE INDEX IF NOT EXISTS factoring_one_open_per_order
  ON public.factoring_requests (order_id)
  WHERE order_id IS NOT NULL AND status IN ('pending', 'approved');

-- 5) Products: public sees active only; owners see own drafts
DROP POLICY IF EXISTS "products_select_all" ON public.products;
DROP POLICY IF EXISTS "products_select_public_or_owner" ON public.products;
CREATE POLICY "products_select_public_or_owner" ON public.products
  FOR SELECT
  USING (
    status = 'active'
    OR auth.uid() = seller_id
  );
