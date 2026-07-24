-- 047: Yelly — conversations assistant IA (RLS owner-only)
CREATE TABLE IF NOT EXISTS public.yelly_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.yelly_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.yelly_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS yelly_conversations_user_idx
  ON public.yelly_conversations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS yelly_messages_conv_idx
  ON public.yelly_messages (conversation_id, created_at ASC);

ALTER TABLE public.yelly_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yelly_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS yelly_conversations_owner ON public.yelly_conversations;
CREATE POLICY yelly_conversations_owner ON public.yelly_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS yelly_messages_owner ON public.yelly_messages;
CREATE POLICY yelly_messages_owner ON public.yelly_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.yelly_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.yelly_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.yelly_conversations IS 'Sessions chat Yelly (assistant GWA)';
COMMENT ON TABLE public.yelly_messages IS 'Messages Yelly — owner via conversation';
