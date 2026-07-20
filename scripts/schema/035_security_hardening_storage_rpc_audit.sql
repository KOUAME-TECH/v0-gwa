-- 035_security_hardening_storage_rpc_audit.sql
-- Corrige : Storage SELECT trop large, RPC SECURITY DEFINER exposés, audit_logs INSERT permissif.
-- Compatible architecture GWA : mutations admin via service_role ; buckets restent public=true (URLs CDN).

-- ─────────────────────────────────────────────────────────────
-- A) admin_roles policies : plus d'appel RPC côté client
--    (promote/revoke uniquement via API service_role)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_roles_select_own_or_super" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_insert_super" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_update_super" ON public.admin_roles;

CREATE POLICY "admin_roles_select_own"
  ON public.admin_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

-- Pas de INSERT/UPDATE pour authenticated : service_role bypasse RLS.

-- ─────────────────────────────────────────────────────────────
-- B) Révoquer EXECUTE des helpers admin (anti-énumération RPC)
--    Garder SECURITY DEFINER au cas où service_role / migrations en ont besoin.
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_active_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_admin(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- C) Storage : supprimer les SELECT qui permettent de lister tout un bucket
--    Les buckets restent public → URLs /object/public/... continuent de marcher.
--    Listing API réservé service_role (bypass) + owner authentifié (dossier uid/).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for products" ON storage.objects;
DROP POLICY IF EXISTS "Public can view post images" ON storage.objects;

-- Lecture / listing limité au dossier de l'utilisateur (convention path: {uid}/...)
DROP POLICY IF EXISTS "Users can select own storage objects" ON storage.objects;
CREATE POLICY "Users can select own storage objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('avatars', 'products', 'posts', 'chat-media', 'cooperatives', 'community')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────
-- D) audit_logs : retirer INSERT WITH CHECK (true) pour public
--    service_role bypasse RLS → inserts backend OK sans policy.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
        AND ar.is_active = true
    )
  );

-- S'assurer qu'aucun grant direct d'écriture n'existe pour anon/authenticated
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
