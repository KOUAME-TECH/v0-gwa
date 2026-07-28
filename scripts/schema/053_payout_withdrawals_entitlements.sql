-- 053 — Escrow payout + retraits wallet (promesse BP)
-- orders: suivi payout FeexPay à la confirmation
-- withdrawal_requests: retraits vendeur (plus de simulation UX)

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payout_ref text,
  ADD COLUMN IF NOT EXISTS payout_status text,
  ADD COLUMN IF NOT EXISTS payout_network text,
  ADD COLUMN IF NOT EXISTS payout_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_error text;

COMMENT ON COLUMN public.orders.payout_status IS
  'pending|processing|paid|failed|skipped_sim — payout vendeur après confirm';

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_fcfa integer NOT NULL CHECK (amount_fcfa >= 1000),
  phone text NOT NULL,
  network text NOT NULL DEFAULT 'orange_ci',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  feexpay_ref text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user
  ON public.withdrawal_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
  ON public.withdrawal_requests (status);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS withdrawal_requests_select_own ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_select_own
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS withdrawal_requests_insert_own ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_insert_own
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- factoring priority snapshot (abo Pro / Enterprise)
ALTER TABLE public.factoring_requests
  ADD COLUMN IF NOT EXISTS queue_priority integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_factoring_requests_priority
  ON public.factoring_requests (queue_priority DESC, created_at ASC);
