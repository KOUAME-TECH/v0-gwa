-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260718114418 · nom « 022_f3_escrow » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paiement_schema TEXT DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS paiement_type TEXT,
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(4,2) DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS commission_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendeur_recoit_fcfa INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feexpay_ref TEXT,
  ADD COLUMN IF NOT EXISTS bon_commande_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_of_shipment_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by_buyer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS litige_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS litige_description TEXT,
  ADD COLUMN IF NOT EXISTS litige_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_sub_type TEXT,
  ADD COLUMN IF NOT EXISTS order_status TEXT;
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tranche_numero INT NOT NULL DEFAULT 1,
  montant_fcfa INT NOT NULL,
  pourcentage NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  feexpay_ref TEXT,
  due_event TEXT NOT NULL DEFAULT 'a_la_commande',
  due_days INT,
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, tranche_numero)
);
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escrow_parties ON public.escrow_transactions;
CREATE POLICY escrow_parties ON public.escrow_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
);
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('orders', 'orders', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;
