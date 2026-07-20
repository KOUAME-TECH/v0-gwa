-- 030_invoices.sql
-- F3 Facture numérique lean — générée à la confirmation acheteur (escrow libéré).
-- Lecture par l'acheteur ou le vendeur ; création via service role.

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  number TEXT NOT NULL UNIQUE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_fcfa NUMERIC(14,2) NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Une seule facture par commande
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer ON public.invoices(buyer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_seller ON public.invoices(seller_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Acheteur ou vendeur peut lire sa facture
DROP POLICY IF EXISTS "invoices_select_party" ON public.invoices;
CREATE POLICY "invoices_select_party" ON public.invoices
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Création/mise à jour via service role uniquement (aucune policy insert/update pour authenticated).
