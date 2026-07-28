-- Secrets plateforme (service_role uniquement) — ex. GEMINI_API_KEY pour Yelly.
-- Jamais exposés au client (pas de SELECT pour anon/authenticated).

CREATE TABLE IF NOT EXISTS public.platform_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_secrets ENABLE ROW LEVEL SECURITY;

-- Aucune policy pour anon/authenticated → lecture/écriture interdites côté client.
-- Accès uniquement via service_role (bypass RLS).

REVOKE ALL ON TABLE public.platform_secrets FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_secrets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_secrets TO service_role;

COMMENT ON TABLE public.platform_secrets IS
  'Secrets ops (Gemini, etc.) — service_role only. Préférer aussi Vercel env en prod.';
