-- 078 — Module 4 : chat-media privé, RLS messages, RPC lecture/offre. Idempotent.

UPDATE storage.buckets SET public = false WHERE id = 'chat-media';
DROP POLICY IF EXISTS "Public read access" ON storage.objects;

-- Un utilisateur ne modifie que ses propres messages non lus.
DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_participant"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = (SELECT auth.uid()) AND coalesce(is_read, false) = false)
  WITH CHECK (sender_id = (SELECT auth.uid()) AND coalesce(is_read, false) = false);

-- Accusés de lecture : uniquement les messages de l'autre participant.
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND auth.uid() IN (c.participant_1, c.participant_2)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages
     SET is_read = true, status = 'read', read_at = now()
   WHERE conversation_id = p_conversation_id
     AND sender_id <> auth.uid()
     AND coalesce(is_read, false) = false;
END;
$$;

-- Réponse à une offre : seul le destinataire, offre encore en attente.
CREATE OR REPLACE FUNCTION public.respond_to_offer(p_message_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.messages%ROWTYPE;
  payload jsonb;
BEGIN
  IF p_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT * INTO m FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND OR m.message_type <> 'offer' THEN
    RAISE EXCEPTION 'offer not found';
  END IF;
  IF m.sender_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot respond to own offer' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = m.conversation_id AND auth.uid() IN (c.participant_1, c.participant_2)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  payload := m.content::jsonb;
  IF coalesce(payload->>'status', 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'offer already answered';
  END IF;

  UPDATE public.messages
     SET content = jsonb_set(payload, '{status}', to_jsonb(p_status))::text,
         is_edited = true
   WHERE id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_offer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_offer(uuid, text) TO authenticated;
