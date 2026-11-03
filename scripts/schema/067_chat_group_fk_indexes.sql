-- Excellence Protocol — indexes FK group chat (advisor performance)
-- À appliquer en staging puis prod après revue humaine.
-- Ne touche pas GeniusPay / FeexPay.

CREATE INDEX IF NOT EXISTS idx_group_conversations_created_by
  ON public.group_conversations (created_by);

CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON public.group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_id
  ON public.group_messages (group_id);

CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to_id
  ON public.group_messages (reply_to_id);

CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id
  ON public.group_messages (sender_id);
