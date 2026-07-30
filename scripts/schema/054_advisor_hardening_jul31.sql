-- 054 Advisor hardening (31 juil. 2026)
-- Corrige les findings Security Advisor post-migrations 050–053 :
-- 1) platform_secrets : policy deny explicite (RLS Enabled No Policy)
-- 2) SECURITY DEFINER coop : REVOKE PUBLIC/anon (garder authenticated pour RLS)
-- 3) Auth RLS InitPlan : (select auth.uid()) sur policies récentes
-- 4) Index FK subscription_requests.activated_by
-- Note: « Leaked Password Protection » = Auth Dashboard (manuel).
-- Note: « Unused Index » = bruit bêta — ne pas DROP massif.

-- ─────────────────────────────────────────────
-- A) platform_secrets — deny anon/authenticated
-- ─────────────────────────────────────────────
ALTER TABLE public.platform_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_secrets FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_secrets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_secrets TO service_role;

DROP POLICY IF EXISTS platform_secrets_deny_all ON public.platform_secrets;
CREATE POLICY platform_secrets_deny_all
  ON public.platform_secrets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ─────────────────────────────────────────────
-- B) Coop SECURITY DEFINER — pas d’EXECUTE public/anon
-- ─────────────────────────────────────────────
ALTER FUNCTION public.is_coop_manager(uuid) SET search_path = public;
ALTER FUNCTION public.is_coop_admin_member(uuid) SET search_path = public;

REVOKE ALL ON FUNCTION public.is_coop_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_coop_manager(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_coop_admin_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_coop_admin_member(uuid) FROM anon;

-- authenticated requis : policies RLS appellent ces helpers
GRANT EXECUTE ON FUNCTION public.is_coop_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_coop_admin_member(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────
-- C) Policies : wrap auth.uid() → (select auth.uid())
-- ─────────────────────────────────────────────

-- cooperatives
DROP POLICY IF EXISTS "cooperatives_update_managers" ON public.cooperatives;
CREATE POLICY "cooperatives_update_managers"
  ON public.cooperatives
  FOR UPDATE
  USING (
    admin_id = (select auth.uid())
    OR public.is_coop_manager(id)
  );

-- cooperative_members
DROP POLICY IF EXISTS "coop_members_update_self_or_admin" ON public.cooperative_members;
CREATE POLICY "coop_members_update_self_or_admin"
  ON public.cooperative_members
  FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR public.is_coop_admin_member(cooperative_id)
  );

DROP POLICY IF EXISTS "coop_members_delete_admin" ON public.cooperative_members;
CREATE POLICY "coop_members_delete_admin"
  ON public.cooperative_members
  FOR DELETE
  USING (public.is_coop_admin_member(cooperative_id));

-- subscription_requests
DROP POLICY IF EXISTS "sub_req_select_own" ON public.subscription_requests;
CREATE POLICY "sub_req_select_own"
  ON public.subscription_requests
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "sub_req_insert_own" ON public.subscription_requests;
CREATE POLICY "sub_req_insert_own"
  ON public.subscription_requests
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- withdrawal_requests
DROP POLICY IF EXISTS withdrawal_requests_select_own ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_select_own
  ON public.withdrawal_requests
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS withdrawal_requests_insert_own ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_insert_own
  ON public.withdrawal_requests
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Catch-all : toute policy restante encore avec auth.uid() nu
DO $$
DECLARE
  pol record;
  new_using text;
  new_check text;
  sql text;
  roles_clause text;
BEGIN
  FOR pol IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'cooperatives',
        'cooperative_members',
        'subscription_requests',
        'withdrawal_requests'
      )
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
      )
      AND coalesce(qual, '') NOT LIKE '%(select auth.uid())%'
      AND coalesce(with_check, '') NOT LIKE '%(select auth.uid())%'
  LOOP
    new_using := pol.qual;
    new_check := pol.with_check;

    IF new_using IS NOT NULL THEN
      new_using := replace(new_using, 'auth.uid()', '(select auth.uid())');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
    END IF;

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );

    IF pol.roles = ARRAY['public']::name[] OR pol.roles IS NULL THEN
      roles_clause := 'PUBLIC';
    ELSE
      SELECT string_agg(quote_ident(r), ', ')
        INTO roles_clause
      FROM unnest(pol.roles) AS r;
    END IF;

    sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      pol.cmd,
      roles_clause
    );

    IF pol.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL') AND new_using IS NOT NULL THEN
      sql := sql || format(' USING (%s)', new_using);
    END IF;
    IF pol.cmd IN ('INSERT', 'UPDATE', 'ALL') AND new_check IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE sql;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- D) Index FK manquant
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscription_requests_activated_by
  ON public.subscription_requests (activated_by)
  WHERE activated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
  ON public.withdrawal_requests (user_id);
