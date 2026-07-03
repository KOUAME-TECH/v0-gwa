-- ============================================================
-- GWA PLATFORM — Migration F5 : Messagerie + Notifications
-- Realtime via Supabase (remplace Socket.io)
-- ADDITIVE — ne modifie pas les colonnes existantes
-- ============================================================

-- ============================================================
-- Étendre la table messages existante avec les champs F5
-- ============================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID,
  ADD COLUMN IF NOT EXISTS recipient_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('queued','sent','delivered','read')),
  ADD COLUMN IF NOT EXISTS delivered_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_ref_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- conversation_id = LEAST(sender_id, recipient_id) || ':' || GREATEST(...)
-- Généré côté API lors de l'insertion

-- Index messagerie
CREATE INDEX IF NOT EXISTS idx_messages_conv_id     ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient   ON public.messages(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_sender      ON public.messages(sender_id, created_at DESC);

-- Activer Realtime sur messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================
-- Étendre la table notifications existante avec les champs F5
-- ============================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body   TEXT,
  ADD COLUMN IF NOT EXISTS data   JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS read   BOOLEAN DEFAULT FALSE;

-- Harmoniser le type CHECK sur notifications
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'message','order_status','payment','scg_change','coop_join',
    'coop_creation','yelly_alert','system','order','review','promotion'
  ));

-- Index notifications
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON public.notifications(user_id, read, created_at DESC);

-- Activer Realtime sur notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============================================================
-- Table push_tokens (OneSignal player_ids par utilisateur)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id     TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'android'
    CHECK (platform IN ('android','ios','web')),
  device_model  TEXT,
  app_version   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, player_id)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_own ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

-- ============================================================
-- Trigger : marquer messages 'delivered' quand le destinataire
-- est en ligne (polling côté API)
-- ============================================================
CREATE OR REPLACE FUNCTION mark_messages_delivered_for_user(p_user_id UUID)
RETURNS INT AS $$
DECLARE delivered_count INT;
BEGIN
  UPDATE public.messages
  SET status = 'delivered', delivered_at = now()
  WHERE recipient_id = p_user_id
    AND status = 'sent';
  GET DIAGNOSTICS delivered_count = ROW_COUNT;
  RETURN delivered_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fonction helper : créer une notification + push (appelée par APIs)
-- ============================================================
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT,
  p_data    JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, body, data, read)
  VALUES (p_user_id, p_type, p_title, p_body, p_body, p_data, FALSE)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
