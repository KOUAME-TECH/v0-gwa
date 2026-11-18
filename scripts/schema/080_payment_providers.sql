-- Fournisseurs de paiement. Les taux se changent ici, sans redéployer le code.
-- 080, parce que 079 régularise déjà le grand livre de GWA-MW16COUJ.
-- GENIUSPAY est le prestataire du moment : encaissement branché, virement encore manuel.
-- PAWAPAY est préparé pour mars 2027 : inactif, automatisation prévue.

CREATE TABLE IF NOT EXISTS public.payment_providers_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL UNIQUE,
  payin_rate numeric(8, 6) NOT NULL,
  payout_fixed_fee integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  automation_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_providers_config_name_check
    CHECK (provider_name IN ('GENIUSPAY', 'PAWAPAY', 'MOOV_API', 'MOCK')),
  CONSTRAINT payment_providers_config_payin_check
    CHECK (payin_rate >= 0 AND payin_rate < 1),
  CONSTRAINT payment_providers_config_payout_check
    CHECK (payout_fixed_fee >= 0)
);

ALTER TABLE public.payment_providers_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_providers_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_providers_config TO service_role;

INSERT INTO public.payment_providers_config
  (provider_name, payin_rate, payout_fixed_fee, is_active, automation_enabled)
VALUES
  ('GENIUSPAY', 0.025000, 300, true, false),
  ('PAWAPAY', 0.015000, 150, false, true)
ON CONFLICT (provider_name) DO NOTHING;
