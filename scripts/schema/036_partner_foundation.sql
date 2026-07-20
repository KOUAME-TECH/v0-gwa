-- 036_partner_foundation.sql
-- Fondation partenaires financiers (banque / IMF) — architecture now, UI post-bêta.
-- Ne pas ajouter user_type=banque au signup. Couche séparée de admin_roles.

CREATE TABLE IF NOT EXISTS public.partner_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CI',
  contact_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('partner_viewer', 'partner_analyst')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_roles_user ON public.partner_roles(user_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_partner_roles_org ON public.partner_roles(organization_id)
  WHERE is_active = true;

ALTER TABLE public.partner_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_roles ENABLE ROW LEVEL SECURITY;

-- Lecture organisation : membre partenaire actif uniquement (pas de listing public)
DROP POLICY IF EXISTS "partner_orgs_select_member" ON public.partner_organizations;
CREATE POLICY "partner_orgs_select_member"
  ON public.partner_organizations
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.partner_roles pr
      WHERE pr.organization_id = partner_organizations.id
        AND pr.user_id = auth.uid()
        AND pr.is_active = true
    )
  );

-- partner_roles : SELECT own row only (comme admin_roles post-035)
DROP POLICY IF EXISTS "partner_roles_select_own" ON public.partner_roles;
CREATE POLICY "partner_roles_select_own"
  ON public.partner_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

-- Pas d'INSERT/UPDATE/DELETE pour authenticated : provisioning via service_role / API.

REVOKE ALL ON public.partner_organizations FROM anon;
REVOKE ALL ON public.partner_roles FROM anon;
GRANT SELECT ON public.partner_organizations TO authenticated;
GRANT SELECT ON public.partner_roles TO authenticated;

COMMENT ON TABLE public.partner_organizations IS
  'Organisations partenaires (banque/IMF). UI /partner post-bêta ; bêta = export CSV admin.';
COMMENT ON TABLE public.partner_roles IS
  'Accès partenaire lecture seule. Ne jamais fusionner avec admin_roles.';
