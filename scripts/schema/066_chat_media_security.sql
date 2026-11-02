-- 066_chat_media_security.sql
-- Chat GWA : MIME audio/docs, chemins {uid}/{conversation_id}/...,
-- lecture Storage pour les 2 participants, UPDATE messages (lu + offres).

-- ─────────────────────────────────────────────────────────────
-- A) Bucket chat-media : autoriser vocaux + docs courants
-- ─────────────────────────────────────────────────────────────
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 12582912,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/aac',
    'audio/wav',
    'audio/x-m4a',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ]
WHERE id = 'chat-media';

-- ─────────────────────────────────────────────────────────────
-- B) Storage SELECT : propriétaire OU co-participant conversation
--    Path : {userId}/{conversationId}/{file}
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can select own storage objects" ON storage.objects;
CREATE POLICY "Users can select own storage objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('avatars', 'products', 'posts', 'cooperatives', 'community')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat_media_select_participants" ON storage.objects;
CREATE POLICY "chat_media_select_participants"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id::text = (storage.foldername(name))[2]
          AND (
            c.participant_1 = auth.uid()
            OR c.participant_2 = auth.uid()
          )
      )
    )
  );

-- INSERT déjà : chat_media_insert_own_folder (1er segment = uid)
DROP POLICY IF EXISTS "chat_media_insert_own_folder" ON storage.objects;
CREATE POLICY "chat_media_insert_own_folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND (
          c.participant_1 = auth.uid()
          OR c.participant_2 = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────
-- C) Messages UPDATE : participants (accusés de lecture + offres)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
CREATE POLICY "messages_update_participant"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.participant_1 = (SELECT auth.uid())
          OR c.participant_2 = (SELECT auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.participant_1 = (SELECT auth.uid())
          OR c.participant_2 = (SELECT auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;
CREATE POLICY "messages_delete_own"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = sender_id);

-- Types média courants (tolérant si déjà élargi)
DO $$
BEGIN
  ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
-- Pas de CHECK strict : text|image|voice|file|offer|location (évolutif)

COMMENT ON POLICY "messages_update_participant" ON public.messages IS
  'Participants only: read receipts + offer accept/decline.';
COMMENT ON POLICY "chat_media_select_participants" ON storage.objects IS
  'Chat media readable by conversation participants (path uid/convId/file).';
