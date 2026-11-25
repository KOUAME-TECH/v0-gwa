-- 066 Security Advisors hardening (GWA-DATABASE frorfexbcyfbydkiwxqv)
-- Corrige :
-- 1) CRITICAL Security Definer View : public.profiles_self_pii → security_invoker
-- 2) Auth RLS InitPlan : auth.uid() → (select auth.uid()) sur policies flagged
-- 3) REVOKE EXECUTE PUBLIC/anon/authenticated sur triggers SECURITY DEFINER protect_*
--
-- HORS SQL (action humaine Auth Dashboard) :
--   Authentication → Providers / Settings → Password → Enable leaked password protection
--   Docs: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
--
-- Rollback : scripts/schema/066_security_advisors_hardening.rollback.sql

-- ─────────────────────────────────────────────
-- A) profiles_self_pii — security_invoker
--    View inutilisée dans l'app (rg profiles_self_pii = schema only).
--    authenticated a déjà SELECT colonne PII ; invoker + WHERE id = auth.uid() OK.
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.profiles_self_pii
WITH (security_invoker = true) AS
SELECT
  id,
  email,
  phone,
  linked_email,
  address,
  onesignal_player_id
FROM public.profiles
WHERE id = (SELECT auth.uid());

GRANT SELECT ON public.profiles_self_pii TO authenticated;

COMMENT ON VIEW public.profiles_self_pii IS
  'PII du profil courant uniquement (security_invoker). Admin PII via /api/admin/* (service_role).';

-- ─────────────────────────────────────────────
-- B) Auth RLS InitPlan — policies flagged (performance advisor)
-- ─────────────────────────────────────────────

-- reviews
DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
CREATE POLICY reviews_insert_own
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = reviewer_id)
    AND (order_id IS NOT NULL)
    AND (EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.buyer_id = (SELECT auth.uid())
        AND (o.status = 'delivered' OR o.escrow_status = 'released')
    ))
  );

-- messages
DROP POLICY IF EXISTS messages_update_own ON public.messages;
CREATE POLICY messages_update_own
  ON public.messages
  FOR UPDATE
  USING (
    ((SELECT auth.uid()) = sender_id)
    AND (COALESCE(message_type, 'text') <> 'offer')
  )
  WITH CHECK (
    ((SELECT auth.uid()) = sender_id)
    AND (COALESCE(message_type, 'text') <> 'offer')
  );

DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant
  ON public.messages
  FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = sender_id)
    AND (EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.participant_1 = (SELECT auth.uid())
          OR c.participant_2 = (SELECT auth.uid())
        )
    ))
  );

-- cooperative_members
DROP POLICY IF EXISTS coop_members_insert_self_member ON public.cooperative_members;
CREATE POLICY coop_members_insert_self_member
  ON public.cooperative_members
  FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (COALESCE(role, 'member') = 'member')
  );

-- products
DROP POLICY IF EXISTS products_select_public_or_owner ON public.products;
CREATE POLICY products_select_public_or_owner
  ON public.products
  FOR SELECT
  USING (
    (status = 'active')
    OR ((SELECT auth.uid()) = seller_id)
  );

-- product_likes
DROP POLICY IF EXISTS product_likes_insert_own ON public.product_likes;
CREATE POLICY product_likes_insert_own
  ON public.product_likes
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS product_likes_delete_own ON public.product_likes;
CREATE POLICY product_likes_delete_own
  ON public.product_likes
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- product_dislikes
DROP POLICY IF EXISTS product_dislikes_insert_own ON public.product_dislikes;
CREATE POLICY product_dislikes_insert_own
  ON public.product_dislikes
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS product_dislikes_delete_own ON public.product_dislikes;
CREATE POLICY product_dislikes_delete_own
  ON public.product_dislikes
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ─────────────────────────────────────────────
-- C) protect_* SECURITY DEFINER — trigger-only EXECUTE
--    Path trigger ne nécessite pas EXECUTE pour anon/authenticated.
--    Même pattern que 048 / 056 (protect_factoring_insert déjà durci).
-- ─────────────────────────────────────────────
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'protect_escrow_insert()',
    'protect_offer_message_insert()',
    'protect_order_insert_privileged()',
    'protect_review_insert()',
    'protect_review_update()',
    'protect_withdrawal_insert()'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO postgres, service_role', fn);
  END LOOP;
END $$;
