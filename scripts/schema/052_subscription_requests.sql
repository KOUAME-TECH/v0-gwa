-- Demandes d'abonnement vendeur (Starter / Pro / Enterprise).

CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_tier TEXT NOT NULL CHECK (
    requested_tier IN ('starter', 'pro', 'enterprise')
  ),
  current_tier TEXT,
  amount_fcfa INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'activated', 'rejected', 'cancelled')
  ),
  note TEXT,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_user
  ON public.subscription_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_requests_status
  ON public.subscription_requests (status, created_at DESC);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sub_req_select_own" ON public.subscription_requests;
CREATE POLICY "sub_req_select_own"
  ON public.subscription_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sub_req_insert_own" ON public.subscription_requests;
CREATE POLICY "sub_req_insert_own"
  ON public.subscription_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.subscription_requests IS
  'Demandes abo vendeur — activation manuelle (WhatsApp / admin) jusqu’au paiement live';
