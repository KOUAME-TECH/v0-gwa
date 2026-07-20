-- 029_factoring.sql
-- F3/F5 Affacturage (semi-manuel) — demandes de financement adossées au SCG.
-- Décision admin via service role uniquement (pas de décaissement auto en bêta).

CREATE TABLE IF NOT EXISTS public.factoring_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount_fcfa NUMERIC(14,2) NOT NULL CHECK (amount_fcfa > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed')),
  scg_score_snapshot INTEGER,
  scg_badge_snapshot TEXT,
  admin_notes TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factoring_requester ON public.factoring_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_factoring_status ON public.factoring_requests(status);
CREATE INDEX IF NOT EXISTS idx_factoring_created ON public.factoring_requests(created_at DESC);

ALTER TABLE public.factoring_requests ENABLE ROW LEVEL SECURITY;

-- Le demandeur voit ses propres demandes
DROP POLICY IF EXISTS "factoring_select_own" ON public.factoring_requests;
CREATE POLICY "factoring_select_own" ON public.factoring_requests
  FOR SELECT USING (auth.uid() = requester_id);

-- Le demandeur crée sa propre demande (le snapshot SCG est écrit côté serveur)
DROP POLICY IF EXISTS "factoring_insert_own" ON public.factoring_requests;
CREATE POLICY "factoring_insert_own" ON public.factoring_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Pas de policy UPDATE/DELETE pour authenticated : décision admin via service role.

-- Empêcher un demandeur de préremplir un statut décidé ou un snapshot falsifié.
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

  -- Un utilisateur ne peut créer qu'une demande "pending" non décidée.
  NEW.status := 'pending';
  NEW.decided_by := NULL;
  NEW.decided_at := NULL;
  NEW.admin_notes := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_factoring_insert ON public.factoring_requests;
CREATE TRIGGER trg_protect_factoring_insert
  BEFORE INSERT ON public.factoring_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_factoring_insert();

REVOKE ALL ON FUNCTION public.protect_factoring_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_factoring_insert() FROM anon, authenticated;
