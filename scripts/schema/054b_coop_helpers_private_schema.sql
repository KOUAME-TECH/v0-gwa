-- 054b — Helpers coop hors schéma API (clear Advisor WARN SECURITY DEFINER)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_coop_manager(p_coop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cooperative_members cm
    WHERE cm.cooperative_id = p_coop_id
      AND cm.user_id = (select auth.uid())
      AND cm.is_active IS DISTINCT FROM false
      AND cm.role IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION private.is_coop_admin_member(p_coop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cooperative_members cm
    WHERE cm.cooperative_id = p_coop_id
      AND cm.user_id = (select auth.uid())
      AND cm.is_active IS DISTINCT FROM false
      AND cm.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.is_coop_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_coop_admin_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_coop_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_coop_admin_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "cooperatives_update_managers" ON public.cooperatives;
CREATE POLICY "cooperatives_update_managers"
  ON public.cooperatives
  FOR UPDATE
  USING (
    admin_id = (select auth.uid())
    OR private.is_coop_manager(id)
  );

DROP POLICY IF EXISTS "coop_members_update_self_or_admin" ON public.cooperative_members;
CREATE POLICY "coop_members_update_self_or_admin"
  ON public.cooperative_members
  FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR private.is_coop_admin_member(cooperative_id)
  );

DROP POLICY IF EXISTS "coop_members_delete_admin" ON public.cooperative_members;
CREATE POLICY "coop_members_delete_admin"
  ON public.cooperative_members
  FOR DELETE
  USING (private.is_coop_admin_member(cooperative_id));

-- Public wrappers : INVOKER + revoke client (plus d’RPC PostgREST utile)
CREATE OR REPLACE FUNCTION public.is_coop_manager(p_coop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.is_coop_manager(p_coop_id);
$$;

CREATE OR REPLACE FUNCTION public.is_coop_admin_member(p_coop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.is_coop_admin_member(p_coop_id);
$$;

REVOKE ALL ON FUNCTION public.is_coop_manager(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_coop_admin_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_coop_manager(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_coop_admin_member(uuid) TO service_role;
