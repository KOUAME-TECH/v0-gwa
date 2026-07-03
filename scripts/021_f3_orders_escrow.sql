-- ============================================================
-- GWA PLATFORM — Migration F3 : Commandes + Escrow Feexpay
-- ADDITIVE — ne modifie pas les colonnes existantes
-- ============================================================

-- Étendre la table orders existante
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending'
    CHECK (escrow_status IN ('pending','held','released','refunded','disputed')),
  ADD COLUMN IF NOT EXISTS paiement_schema TEXT DEFAULT 'full'
    CHECK (paiement_schema IN ('full','acompte_solde','tranches')),
  ADD COLUMN IF NOT EXISTS montant_total_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2) DEFAULT 5,
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
    CHECK (seller_sub_type IN ('producteur_individuel','cooperative',NULL));

-- Contrainte statuts F3 (compatible avec les statuts legacy)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'en_attente','paiement_escrow','confirme',
    'en_preparation','en_transit','livre','litige','annule_rembourse'
  ) OR order_status IS NULL);

-- Index commandes
CREATE INDEX IF NOT EXISTS idx_orders_buyer        ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller       ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_escrow       ON public.orders(escrow_status);
CREATE INDEX IF NOT EXISTS idx_orders_created      ON public.orders(created_at DESC);

-- ============================================================
-- Table escrow_transactions (paiements par tranches)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id         UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tranche_numero   INT NOT NULL DEFAULT 1,
  montant_fcfa     INT NOT NULL,
  pourcentage      NUMERIC(5,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','held','released','refunded')),
  feexpay_ref      TEXT,
  due_event        TEXT NOT NULL DEFAULT 'a_la_commande'
    CHECK (due_event IN (
      'a_la_commande','a_l_expedition','a_la_livraison','a_x_jours_livraison'
    )),
  due_days         INT,
  paid_at          TIMESTAMPTZ,
  released_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, tranche_numero)
);

ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY escrow_parties_select ON public.escrow_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_escrow_order   ON public.escrow_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status  ON public.escrow_transactions(status);

-- ============================================================
-- Trigger : mise à jour automatique stock après commande confirmée
-- ============================================================
CREATE OR REPLACE FUNCTION update_product_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand une commande passe à 'confirme', décrémenter le stock
  IF NEW.order_status = 'confirme' AND
     (OLD.order_status IS NULL OR OLD.order_status != 'confirme') THEN
    UPDATE public.products p
    SET quantite_disponible_kg = GREATEST(
      COALESCE(p.quantite_disponible_kg, 0) -
      COALESCE((
        SELECT SUM(oi.quantity)
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id
      ), 0),
      0
    )
    WHERE p.id IN (
      SELECT DISTINCT product_id FROM public.order_items WHERE order_id = NEW.id
    );
    -- Passer en rupture si stock = 0
    UPDATE public.products
    SET status = 'rupture'
    WHERE id IN (
      SELECT DISTINCT product_id FROM public.order_items WHERE order_id = NEW.id
    )
    AND COALESCE(quantite_disponible_kg, 0) <= 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stock_on_order ON public.orders;
CREATE TRIGGER trg_stock_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_product_stock_on_order();

-- ============================================================
-- Trigger : auto-release escrow 72h (appelé par Edge Function cron)
-- La fonction Edge Function fait : SELECT auto_release_escrow()
-- ============================================================
CREATE OR REPLACE FUNCTION auto_release_escrow()
RETURNS INT AS $$
DECLARE
  released_count INT := 0;
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT id, seller_id, vendeur_recoit_fcfa
    FROM public.orders
    WHERE order_status = 'livre'
      AND confirmed_by_buyer_at IS NULL
      AND delivered_at < now() - INTERVAL '72 hours'
      AND escrow_status = 'held'
  LOOP
    UPDATE public.orders
    SET escrow_status = 'released',
        confirmed_by_buyer_at = now(),
        updated_at = now()
    WHERE id = v_order.id;

    UPDATE public.escrow_transactions
    SET status = 'released',
        released_at = now()
    WHERE order_id = v_order.id
      AND status = 'held';

    released_count := released_count + 1;
  END LOOP;
  RETURN released_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
