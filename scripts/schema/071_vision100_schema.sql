-- Vision 100 — Mission 1
-- N'efface pas pricing_plans : les grilles FREE / STARTER / PRO / COOP_*
-- sont déjà en production et servent le calcul des commandes GeniusPay.
-- On ajoute seulement les colonnes manquantes, puis les tables nouvelles.

ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS payout_included integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'XOF';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS preorder_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS harvest_date date;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_preorder_quantity_nonneg;
ALTER TABLE public.products
  ADD CONSTRAINT products_preorder_quantity_nonneg
  CHECK (preorder_quantity >= 0);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  name text PRIMARY KEY,
  is_active_public boolean NOT NULL DEFAULT false,
  is_active_beta boolean NOT NULL DEFAULT false,
  description text
);

INSERT INTO public.feature_flags (name, is_active_public, is_active_beta, description)
VALUES
  ('buyer_subscription', false, false, 'Abonnement acheteur'),
  ('rfq_aggregation', false, false, 'Regroupement des demandes d’achat'),
  ('factoring', false, false, 'Affacturage'),
  ('internal_wallet', false, false, 'Portefeuille interne'),
  ('video_calls', false, false, 'Appels vidéo'),
  ('eudr_tracking', false, false, 'Suivi EUDR')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  account_debit text NOT NULL,
  account_credit text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL DEFAULT 'XOF',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_ledger_transaction_id_idx
  ON public.financial_ledger (transaction_id);

CREATE TABLE IF NOT EXISTS public.buyer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  volume_requested integer NOT NULL CHECK (volume_requested > 0),
  target_price integer CHECK (target_price IS NULL OR target_price >= 0),
  deadline date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buyer_requests_buyer_status_idx
  ON public.buyer_requests (buyer_id, status);

CREATE TABLE IF NOT EXISTS public.aggregated_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_request_id uuid NOT NULL REFERENCES public.buyer_requests(id) ON DELETE CASCADE,
  producer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume_committed integer NOT NULL CHECK (volume_committed > 0),
  price_offered integer CHECK (price_offered IS NULL OR price_offered >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_request_id, producer_id)
);

CREATE INDEX IF NOT EXISTS aggregated_offers_request_idx
  ON public.aggregated_offers (buyer_request_id);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregated_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_read ON public.feature_flags;
CREATE POLICY feature_flags_read
  ON public.feature_flags
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS buyer_requests_own ON public.buyer_requests;
CREATE POLICY buyer_requests_own
  ON public.buyer_requests
  FOR ALL
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS aggregated_offers_producer ON public.aggregated_offers;
CREATE POLICY aggregated_offers_producer
  ON public.aggregated_offers
  FOR ALL
  TO authenticated
  USING (auth.uid() = producer_id)
  WITH CHECK (auth.uid() = producer_id);

DROP POLICY IF EXISTS aggregated_offers_buyer_read ON public.aggregated_offers;
CREATE POLICY aggregated_offers_buyer_read
  ON public.aggregated_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.buyer_requests br
      WHERE br.id = aggregated_offers.buyer_request_id
        AND br.buyer_id = auth.uid()
    )
  );

REVOKE ALL ON public.financial_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aggregated_offers TO authenticated;
GRANT ALL ON public.financial_ledger TO service_role;
