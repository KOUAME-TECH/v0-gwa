-- ============================================================
-- GWA — Migration F3 : Escrow + Paiement Feexpay
-- ADDITIVE UNIQUEMENT
-- ============================================================

-- 1. Extension table orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending'
    CHECK (escrow_status IN ('pending','held','released','refunded','disputed','partially_released')),
  ADD COLUMN IF NOT EXISTS paiement_schema TEXT DEFAULT 'full'
    CHECK (paiement_schema IN ('full','acompte_solde','tranches')),
  ADD COLUMN IF NOT EXISTS paiement_type TEXT
    CHECK (paiement_type IN ('orange_money','mtn_money','moov_money','wave','virement_bancaire') OR paiement_type IS NULL),
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(4,2) DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS commission_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendeur_recoit_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feexpay_ref TEXT,
  ADD COLUMN IF NOT EXISTS bon_commande_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_of_shipment_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by_buyer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS litige_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS litige_description TEXT,
  ADD COLUMN IF NOT EXISTS litige_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_sub_type TEXT
    CHECK (seller_sub_type IN ('producteur_individuel','cooperative') OR seller_sub_type IS NULL);

-- 2. Extension contrainte statuts commande
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check
  CHECK (status IN (
    'draft','pending','confirmed','processing','shipped','delivered','cancelled',
    'en_attente','paiement_escrow','confirme','en_preparation','en_transit',
    'livre','litige','annule_rembourse'
  ));

-- 3. Table escrow_transactions (paiements par tranches)
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tranche_numero INT NOT NULL DEFAULT 1,
  montant_fcfa INT NOT NULL,
  pourcentage NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','held','released','refunded')),
  feexpay_ref TEXT,
  due_event TEXT NOT NULL DEFAULT 'a_la_commande'
    CHECK (due_event IN ('a_la_commande','a_l_expedition','a_la_livraison','a_x_jours_livraison')),
  due_days INT,
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, tranche_numero)
);
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "escrow_parties" ON public.escrow_transactions;
CREATE POLICY "escrow_parties" ON public.escrow_transactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "escrow_insert_system" ON public.escrow_transactions;
CREATE POLICY "escrow_insert_system" ON public.escrow_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.buyer_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_escrow_order ON public.escrow_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON public.escrow_transactions(status);

-- 4. Index commandes pour libération auto 72h
CREATE INDEX IF NOT EXISTS idx_orders_escrow_status ON public.orders(escrow_status);
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_buyer ON public.orders(confirmed_by_buyer_at)
  WHERE confirmed_by_buyer_at IS NOT NULL;

-- 5. Fonction numéro de commande GWA
CREATE OR REPLACE FUNCTION generate_gwa_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'GWA-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      UPPER(SUBSTRING(MD5(NEW.id::text), 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gwa_order_number ON public.orders;
CREATE TRIGGER trg_gwa_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION generate_gwa_order_number();
