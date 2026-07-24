-- 048 Advisor Center hardening (security + performance)
-- Corrige :
-- 1) Auth RLS InitPlan : auth.uid() → (select auth.uid())
-- 2) FK sans index
-- 3) digest_runs RLS sans policy
-- 4) search_path mutable (digest helpers)
-- 5) REVOKE EXECUTE sur triggers SECURITY DEFINER (anon/authenticated/public)
-- Note: « Leaked Password Protection » se active dans Auth Dashboard (pas SQL).

-- ─────────────────────────────────────────────
-- A) digest helpers : search_path fixe
-- ─────────────────────────────────────────────
ALTER FUNCTION public.gwa_digest_city_token(text) SET search_path = public;
ALTER FUNCTION public.gwa_digest_country_match(text, text) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.gwa_digest_city_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gwa_digest_country_match(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.gwa_digest_city_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gwa_digest_country_match(text, text) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────
-- B) Revoke RPC sur triggers SECURITY DEFINER
-- ─────────────────────────────────────────────
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'gwa_sync_comment_likes_count()',
    'gwa_sync_post_comments_count()',
    'gwa_sync_product_comments_count()',
    'gwa_sync_review_likes_count()',
    'user_places_ensure_single_primary()'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO postgres, service_role', fn);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- C) digest_runs : policy explicite (service only)
-- ─────────────────────────────────────────────
ALTER TABLE public.digest_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS digest_runs_deny_all ON public.digest_runs;
CREATE POLICY digest_runs_deny_all ON public.digest_runs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- service_role bypass RLS by default; no public access.

-- ─────────────────────────────────────────────
-- D) Auth RLS InitPlan — wrap auth.uid()
-- ─────────────────────────────────────────────
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
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
      )
  LOOP
    new_using := pol.qual;
    new_check := pol.with_check;

    IF new_using IS NOT NULL THEN
      new_using := replace(new_using, '(select auth.uid())', '__GWA_AUTH_UID__');
      new_using := replace(new_using, 'auth.uid()', '(select auth.uid())');
      new_using := replace(new_using, '__GWA_AUTH_UID__', '(select auth.uid())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, '(select auth.uid())', '__GWA_AUTH_UID__');
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
      new_check := replace(new_check, '__GWA_AUTH_UID__', '(select auth.uid())');
    END IF;

    IF new_using IS NOT DISTINCT FROM pol.qual
       AND new_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
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

    IF pol.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
      IF new_check IS NOT NULL THEN
        sql := sql || format(' WITH CHECK (%s)', new_check);
      ELSIF pol.cmd = 'ALL' AND new_using IS NOT NULL THEN
        sql := sql || format(' WITH CHECK (%s)', new_using);
      ELSIF pol.cmd = 'INSERT' AND new_check IS NULL AND new_using IS NOT NULL THEN
        sql := sql || format(' WITH CHECK (%s)', new_using);
      END IF;
    END IF;

    EXECUTE sql;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- E) Indexes sur FK manquants (Advisor)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fk_admin_roles_created_by ON public.admin_roles (created_by);
CREATE INDEX IF NOT EXISTS idx_fk_announcements_created_by ON public.announcements (created_by);
CREATE INDEX IF NOT EXISTS idx_fk_cart_items_product_id ON public.cart_items (product_id);
CREATE INDEX IF NOT EXISTS idx_fk_categories_parent_id ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_fk_contact_messages_assigned_to ON public.contact_messages (assigned_to);
CREATE INDEX IF NOT EXISTS idx_fk_contact_messages_user_id ON public.contact_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_fk_conversations_participant_1 ON public.conversations (participant_1);
CREATE INDEX IF NOT EXISTS idx_fk_conversations_participant_2 ON public.conversations (participant_2);
CREATE INDEX IF NOT EXISTS idx_fk_cooperative_members_user_id ON public.cooperative_members (user_id);
CREATE INDEX IF NOT EXISTS idx_fk_cooperative_stock_cooperative_id ON public.cooperative_stock (cooperative_id);
CREATE INDEX IF NOT EXISTS idx_fk_cooperative_stock_member_id ON public.cooperative_stock (member_id);
CREATE INDEX IF NOT EXISTS idx_fk_cooperative_stock_product_id ON public.cooperative_stock (product_id);
CREATE INDEX IF NOT EXISTS idx_fk_cooperatives_admin_id ON public.cooperatives (admin_id);
CREATE INDEX IF NOT EXISTS idx_fk_course_modules_course_id ON public.course_modules (course_id);
CREATE INDEX IF NOT EXISTS idx_fk_course_progress_course_id ON public.course_progress (course_id);
CREATE INDEX IF NOT EXISTS idx_fk_course_progress_module_id ON public.course_progress (module_id);
CREATE INDEX IF NOT EXISTS idx_fk_courses_instructor_id ON public.courses (instructor_id);
CREATE INDEX IF NOT EXISTS idx_fk_custom_orders_artisan_id ON public.custom_orders (artisan_id);
CREATE INDEX IF NOT EXISTS idx_fk_custom_orders_buyer_id ON public.custom_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_fk_disputes_assigned_to ON public.disputes (assigned_to);
CREATE INDEX IF NOT EXISTS idx_fk_disputes_opened_by ON public.disputes (opened_by);
CREATE INDEX IF NOT EXISTS idx_fk_factoring_requests_decided_by ON public.factoring_requests (decided_by);
CREATE INDEX IF NOT EXISTS idx_fk_factoring_requests_order_id ON public.factoring_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_fk_favorites_product_id ON public.favorites (product_id);
CREATE INDEX IF NOT EXISTS idx_fk_followers_following_id ON public.followers (following_id);
CREATE INDEX IF NOT EXISTS idx_fk_group_conversations_created_by ON public.group_conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_fk_group_members_user_id ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_fk_group_messages_group_id ON public.group_messages (group_id);
CREATE INDEX IF NOT EXISTS idx_fk_group_messages_reply_to_id ON public.group_messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_fk_group_messages_sender_id ON public.group_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_fk_messages_conversation_id ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_fk_messages_order_ref_id ON public.messages (order_ref_id);
CREATE INDEX IF NOT EXISTS idx_fk_messages_reply_to_id ON public.messages (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_fk_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_fk_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_fk_order_audit_log_order_id ON public.order_audit_log (order_id);
CREATE INDEX IF NOT EXISTS idx_fk_order_audit_log_performed_by ON public.order_audit_log (performed_by);
CREATE INDEX IF NOT EXISTS idx_fk_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_fk_order_items_product_id ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_fk_orders_buyer_id ON public.orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_fk_orders_seller_id ON public.orders (seller_id);
CREATE INDEX IF NOT EXISTS idx_fk_platform_settings_updated_by ON public.platform_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_fk_post_comments_author_id ON public.post_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_fk_post_comments_post_id ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_fk_post_likes_user_id ON public.post_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_fk_posts_original_post_id ON public.posts (original_post_id);
CREATE INDEX IF NOT EXISTS idx_fk_product_favorites_product_id ON public.product_favorites (product_id);
CREATE INDEX IF NOT EXISTS idx_fk_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_fk_products_moderated_by ON public.products (moderated_by);
CREATE INDEX IF NOT EXISTS idx_fk_profiles_coop_id ON public.profiles (coop_id);
CREATE INDEX IF NOT EXISTS idx_fk_profiles_suspended_by ON public.profiles (suspended_by);
CREATE INDEX IF NOT EXISTS idx_fk_reports_reporter_id ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_fk_reports_resolved_by ON public.reports (resolved_by);
CREATE INDEX IF NOT EXISTS idx_fk_review_likes_user_id ON public.review_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_fk_reviews_order_id ON public.reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_fk_reviews_product_id ON public.reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_fk_reviews_reviewer_id ON public.reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_fk_reviews_seller_id ON public.reviews (seller_id);
CREATE INDEX IF NOT EXISTS idx_fk_rfq_requests_buyer_id ON public.rfq_requests (buyer_id);
CREATE INDEX IF NOT EXISTS idx_fk_rfq_requests_selected_supplier_id ON public.rfq_requests (selected_supplier_id);
CREATE INDEX IF NOT EXISTS idx_fk_rfq_responses_supplier_id ON public.rfq_responses (supplier_id);
CREATE INDEX IF NOT EXISTS idx_fk_verification_requests_cooperative_id ON public.verification_requests (cooperative_id);
CREATE INDEX IF NOT EXISTS idx_fk_verification_requests_reviewed_by ON public.verification_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_fk_verification_requests_user_id ON public.verification_requests (user_id);
