-- Multi-gestion coopérative : plusieurs personnes habilitées (admin + manager).
-- admin_id reste le titulaire principal ; les managers gèrent aussi via membership.

-- Helper : l’utilisateur courant est-il gestionnaire actif de la coop ?
CREATE OR REPLACE FUNCTION public.is_coop_manager(p_coop_id uuid)
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
      AND cm.user_id = auth.uid()
      AND cm.is_active IS DISTINCT FROM false
      AND cm.role IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_coop_admin_member(p_coop_id uuid)
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
      AND cm.user_id = auth.uid()
      AND cm.is_active IS DISTINCT FROM false
      AND cm.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_coop_manager(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coop_manager(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_coop_admin_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coop_admin_member(uuid) TO authenticated, service_role;

-- UPDATE coop : titulaire OU tout admin/manager actif
DROP POLICY IF EXISTS "cooperatives_update_admin" ON public.cooperatives;
CREATE POLICY "cooperatives_update_managers"
  ON public.cooperatives
  FOR UPDATE
  USING (
    admin_id = auth.uid()
    OR public.is_coop_manager(id)
  );

-- Membres : un admin coop peut mettre à jour les rôles des autres
DROP POLICY IF EXISTS "coop_members_update" ON public.cooperative_members;
CREATE POLICY "coop_members_update_self_or_admin"
  ON public.cooperative_members
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_coop_admin_member(cooperative_id)
  );

-- Suppression de membre (désactivation / retrait) : admin coop seulement
DROP POLICY IF EXISTS "coop_members_delete" ON public.cooperative_members;
CREATE POLICY "coop_members_delete_admin"
  ON public.cooperative_members
  FOR DELETE
  USING (public.is_coop_admin_member(cooperative_id));

COMMENT ON FUNCTION public.is_coop_manager(uuid) IS
  'True si auth.uid() est admin ou manager actif de la coopérative — multi-gestion GWA';
