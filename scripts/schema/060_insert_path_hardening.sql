-- 060 — Close remaining INSERT / RPC attack surfaces (self-regulate)

-- 1) Orders: force safe defaults on client INSERT (service_role only for money fields)
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_insert ON public.orders;
CREATE TRIGGER trg_protect_order_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_insert_privileged();

-- 2) Offers: client INSERT must start as pending (no forged accepted_via)
CREATE OR REPLACE FUNCTION public.protect_offer_message_insert()
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
  j jsonb;
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.message_type, 'text') <> 'offer' THEN
    RETURN NEW;
  END IF;

  BEGIN
    j := NEW.content::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_offer_json';
  END;

  -- Force pending; strip server accept markers
  j := j || jsonb_build_object('status', 'pending');
  j := j - 'accepted_by' - 'accepted_at' - 'accepted_via'
         - 'declined_by' - 'declined_at' - 'declined_via';
  NEW.content := j::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_offer_insert ON public.messages;
CREATE TRIGGER trg_protect_offer_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_offer_message_insert();

-- 3) Stock RPC: service_role only
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO service_role;

-- 4) Coop members: no free INSERT as admin
DROP POLICY IF EXISTS "coop_members_insert" ON public.cooperative_members;
CREATE POLICY "coop_members_insert_self_member"
  ON public.cooperative_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND coalesce(role, 'member') = 'member'
  );

-- 5) Withdrawals: force pending on client INSERT
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
  NEW.status := 'pending';
  NEW.feexpay_ref := NULL;
  NEW.processed_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_withdrawal_insert ON public.withdrawal_requests;
CREATE TRIGGER trg_protect_withdrawal_insert
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_withdrawal_insert();

-- 6) Factoring: wipe client SCG snapshot on INSERT
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
  NEW.status := 'pending';
  NEW.decided_by := NULL;
  NEW.decided_at := NULL;
  NEW.admin_notes := NULL;
  NEW.scg_score_snapshot := NULL;
  NEW.scg_badge_snapshot := NULL;
  RETURN NEW;
END;
$$;

-- 7) Orders storage bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'orders';
