-- Fix infinite recursion on admin_roles RLS
-- Previous "safe" policies still queried admin_roles inside USING → recursion.

CREATE OR REPLACE FUNCTION public.is_active_admin(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE user_id = check_uid
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(check_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE user_id = check_uid
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "admin_roles_select" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_insert" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_update" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_select_safe" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_insert_safe" ON public.admin_roles;
DROP POLICY IF EXISTS "admin_roles_update_safe" ON public.admin_roles;

-- Own row readable without subquery recursion; super_admin can read all via definer fn
CREATE POLICY "admin_roles_select_own_or_super"
  ON public.admin_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "admin_roles_insert_super"
  ON public.admin_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "admin_roles_update_super"
  ON public.admin_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
