-- 038_whatsapp_audio_rich_media.sql
-- GWA — Conditions DB pour publications style WhatsApp :
--   • note vocale seule (post_type = audio)
--   • combo image + vidéo + audio (post_type = rich_media)
--   • photo/vidéo sans voix (post_type = media, inchangé)
--
-- À appliquer en prod Supabase (SQL Editor ou MCP apply_migration) AVANT d'utiliser
-- les nouveaux post_type côté app.

-- 1) Étendre le CHECK post_type (011 n'incluait pas audio / rich_media)
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_post_type_check
  CHECK (post_type IN (
    'post', 'story', 'repost',
    'general', 'media', 'audio', 'rich_media',
    'question', 'astuce', 'temoignage', 'annonce'
  ));

-- 2) Intégrité : type audio ⇒ fichier vocal obligatoire
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_audio_type_requires_url;
ALTER TABLE public.posts ADD CONSTRAINT posts_audio_type_requires_url
  CHECK (post_type <> 'audio' OR audio_url IS NOT NULL);

-- 3) Intégrité : rich_media ⇒ au moins un canal média rempli
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_rich_media_requires_payload;
ALTER TABLE public.posts ADD CONSTRAINT posts_rich_media_requires_payload
  CHECK (
    post_type <> 'rich_media'
    OR audio_url IS NOT NULL
    OR video_url IS NOT NULL
    OR (
      media_urls IS NOT NULL
      AND jsonb_typeof(media_urls) = 'array'
      AND jsonb_array_length(media_urls) > 0
    )
  );

-- 4) Index feed : filtrer rapidement les posts vocaux / multimédia
CREATE INDEX IF NOT EXISTS idx_posts_post_type_created
  ON public.posts (post_type, created_at DESC);

COMMENT ON CONSTRAINT posts_audio_type_requires_url ON public.posts IS
  'WhatsApp-style: post_type audio exige audio_url (note vocale).';

COMMENT ON CONSTRAINT posts_rich_media_requires_payload ON public.posts IS
  'Publication combo (ex. photo+vidéo+voix) : au moins image, vidéo ou audio.';
