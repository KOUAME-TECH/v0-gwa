-- GWA Migration F5 : Messages + Notifications ADDITIVE UNIQUEMENT

-- Extension table messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'
    CHECK (status IN ('queued','sent','delivered','read')),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_ref_id UUID REFERENCES public.orders(id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_parties" ON public.messages;
CREATE POLICY "msg_parties" ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
CREATE POLICY "msg_insert" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "msg_update_read" ON public.messages;
CREATE POLICY "msg_update_read" ON public.messages FOR UPDATE
  USING (auth.uid() = recipient_id);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient
  ON public.messages(recipient_id, status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Table notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'message','order_status','payment','scg_change',
    'coop_join','coop_creation','yelly_alert','system'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_owner" ON public.notifications;
CREATE POLICY "notif_owner" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user
  ON public.notifications(user_id, read, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
