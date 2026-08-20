-- 063 — Escrow transactions: service_role INSERT only

CREATE OR REPLACE FUNCTION public.protect_escrow_insert()
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
  RAISE EXCEPTION 'escrow_insert_service_only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_escrow_insert ON public.escrow_transactions;
CREATE TRIGGER trg_protect_escrow_insert
  BEFORE INSERT ON public.escrow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_escrow_insert();

REVOKE INSERT ON public.escrow_transactions FROM authenticated, anon;
