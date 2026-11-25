-- Rollback 066_security_advisors_hardening.sql
-- Restaure SECURITY DEFINER view (défaut), policies auth.uid() nues, EXECUTE public sur protect_*.
-- À n'utiliser qu'en urgence — réintroduit les findings Security/Performance Advisors.

-- A) View → security definer (défaut PG = security_invoker false)
CREATE OR REPLACE VIEW public.profiles_self_pii AS
SELECT
  id,
  email,
  phone,
  linked_email,
  address,
  onesignal_player_id
FROM public.profiles
WHERE id = auth.uid();

GRANT SELECT ON public.profiles_self_pii TO authenticated;

-- B) Policies pré-066 (auth.uid() nu)
DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
CREATE POLICY reviews_insert_own
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    (auth.uid() = reviewer_id)
    AND (order_id IS NOT NULL)
    AND (EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.buyer_id = auth.uid()
        AND (o.status = 'delivered' OR o.escrow_status = 'released')
    ))
  );

DROP POLICY IF EXISTS messages_update_own ON public.messages;
CREATE POLICY messages_update_own
  ON public.messages
  FOR UPDATE
  USING ((auth.uid() = sender_id) AND (COALESCE(message_type, 'text') <> 'offer'))
  WITH CHECK ((auth.uid() = sender_id) AND (COALESCE(message_type, 'text') <> 'offer'));

DROP POLICY IF EXISTS messages_insert_participant ON public.messages;
CREATE POLICY messages_insert_participant
  ON public.messages
  FOR INSERT
  WITH CHECK (
    (auth.uid() = sender_id)
    AND (EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    ))
  );

DROP POLICY IF EXISTS coop_members_insert_self_member ON public.cooperative_members;
CREATE POLICY coop_members_insert_self_member
  ON public.cooperative_members
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id) AND (COALESCE(role, 'member') = 'member'));

DROP POLICY IF EXISTS products_select_public_or_owner ON public.products;
CREATE POLICY products_select_public_or_owner
  ON public.products
  FOR SELECT
  USING ((status = 'active') OR (auth.uid() = seller_id));

DROP POLICY IF EXISTS product_likes_insert_own ON public.product_likes;
CREATE POLICY product_likes_insert_own
  ON public.product_likes FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS product_likes_delete_own ON public.product_likes;
CREATE POLICY product_likes_delete_own
  ON public.product_likes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS product_dislikes_insert_own ON public.product_dislikes;
CREATE POLICY product_dislikes_insert_own
  ON public.product_dislikes FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS product_dislikes_delete_own ON public.product_dislikes;
CREATE POLICY product_dislikes_delete_own
  ON public.product_dislikes FOR DELETE USING (user_id = auth.uid());

-- C) Restore EXECUTE (pre-hardening ACL)
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
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon, authenticated, service_role', fn);
  END LOOP;
END $$;
