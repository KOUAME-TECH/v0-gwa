-- 043: messages Aide & Contact (support inbox)
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'spam')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON public.contact_messages (status, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Pas d'accès client direct — API service role / admin uniquement
DROP POLICY IF EXISTS contact_messages_deny_all ON public.contact_messages;
CREATE POLICY contact_messages_deny_all ON public.contact_messages
  FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.contact_messages IS
  'Messages du formulaire Aide & Contact — gérés dans /admin/support';
