ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS offer_accepted_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source_offer_message_id UUID
    REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_offer_product_id UUID
    REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS source_offer_quantity INTEGER
    CHECK (source_offer_quantity IS NULL OR source_offer_quantity > 0);

CREATE UNIQUE INDEX IF NOT EXISTS orders_source_offer_message_id_key
  ON public.orders(source_offer_message_id)
  WHERE source_offer_message_id IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS source_offer_message_id UUID
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS order_items_source_offer_message_id_key
  ON public.order_items(source_offer_message_id)
  WHERE source_offer_message_id IS NOT NULL;

ALTER TABLE public.order_audit_log
  ADD COLUMN IF NOT EXISTS source_offer_message_id UUID
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS order_audit_log_source_offer_message_id_key
  ON public.order_audit_log(source_offer_message_id);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS source_offer_message_id UUID
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_offer_message_id_key
  ON public.notifications(source_offer_message_id);

DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
DROP POLICY IF EXISTS "msg_parties" ON public.messages;
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_update_read" ON public.messages;
DROP POLICY IF EXISTS messages_select_conversation_members ON public.messages;
DROP POLICY IF EXISTS messages_insert_conversation_members ON public.messages;
DROP POLICY IF EXISTS messages_update_conversation_members ON public.messages;
DROP POLICY IF EXISTS messages_delete_own ON public.messages;

DROP INDEX IF EXISTS public.idx_messages_recipient;

CREATE POLICY messages_select_conversation_members ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1, conversations.participant_2)
    )
  );

CREATE POLICY messages_insert_conversation_members ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1, conversations.participant_2)
    )
  );

CREATE POLICY messages_update_conversation_members ON public.messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1, conversations.participant_2)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1, conversations.participant_2)
    )
  );

CREATE POLICY messages_delete_own ON public.messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.participant_1, conversations.participant_2)
    )
  );

REVOKE UPDATE ON public.messages FROM PUBLIC, anon, authenticated;
GRANT UPDATE (is_read) ON public.messages TO authenticated;
GRANT DELETE ON public.messages TO authenticated;
