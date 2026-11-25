-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260718121902 · nom « 026_ocpv_prices_realtime » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

CREATE TABLE IF NOT EXISTS public.ocpv_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_fcfa INT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  market TEXT DEFAULT 'Abidjan',
  variation_pct NUMERIC(6,2) DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'OCPV',
  week_label TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ocpv_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ocpv_prices_public_read ON public.ocpv_prices;
CREATE POLICY ocpv_prices_public_read ON public.ocpv_prices FOR SELECT USING (true);

INSERT INTO public.ocpv_prices (product_key, name, price_fcfa, unit, market, variation_pct, source, week_label) VALUES
  ('mais_grain', 'Maïs grain', 410, 'kg', 'Abidjan', 5.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('mil', 'Mil', 570, 'kg', 'Abidjan', 2.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('riz_import', 'Riz importé', 650, 'kg', 'Abidjan', 2.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('riz_local', 'Riz local', 630, 'kg', 'Abidjan', -3.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('banane_plantain', 'Banane plantain', 530, 'kg', 'Abidjan', 0.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('igname_bete', 'Igname bêtê-bêtê', 480, 'kg', 'Abidjan', -2.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('igname_kponan', 'Igname kponan', 710, 'kg', 'Abidjan', -3.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('manioc', 'Manioc', 400, 'kg', 'Abidjan', 8.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('aubergine', 'Aubergine ndrowa', 1020, 'kg', 'Abidjan', -16.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('tomate', 'Tomate SODEFEL', 1640, 'kg', 'Abidjan', 14.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('arachide', 'Arachide décortiquée', 1100, 'kg', 'Abidjan', 1.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('palme', 'Graine de palme', 380, 'kg', 'Abidjan', 9.0, 'OCPV S23 Juin 2026', '01-07 juin 2026'),
  ('cacao', 'Cacao', 1800, 'kg', 'National', 0.0, 'ICCO/Conseil Café-Cacao', 'réf 2026'),
  ('cafe', 'Café Robusta', 1200, 'kg', 'National', 0.0, 'ICO/Conseil Café-Cacao', 'réf 2026'),
  ('cajou', 'Cajou', 1450, 'kg', 'National', 0.0, 'ACA', 'réf 2026')
ON CONFLICT (product_key) DO UPDATE SET
  price_fcfa = EXCLUDED.price_fcfa,
  variation_pct = EXCLUDED.variation_pct,
  week_label = EXCLUDED.week_label,
  updated_at = NOW();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linked_email TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
