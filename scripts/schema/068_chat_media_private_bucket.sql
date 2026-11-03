-- 068_chat_media_private_bucket.sql
-- Excellence Protocol — bucket chat-media non-public.
-- Prérequis clients : upload/resolve/sign sans getPublicUrl (lib/chat/upload.ts).
-- [RISQUE] URLs publiques historiques cessent de fonctionner → resolve via path/sign.

UPDATE storage.buckets
SET public = false
WHERE id = 'chat-media';

COMMENT ON TABLE storage.buckets IS
  'chat-media private since 068 — access via signed URLs + RLS chat_media_*';
