-- 039_comment_voice_listen.sql
-- GWA — Commentaires vocaux (style WhatsApp) + texte cliquable pour écouter.
-- Complète 032 (audio posts) et 038 (rich_media).
--
-- Appliquer en prod Supabase avant d'utiliser les commentaires vocaux.

-- ─── post_comments ───────────────────────────────────────────────────────────
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS comment_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE public.post_comments
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_type_check;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_type_check
  CHECK (comment_type IN ('text', 'voice', 'text_voice'));

ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_payload_check;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_payload_check
  CHECK (
    (content IS NOT NULL AND btrim(content) <> '')
    OR (audio_url IS NOT NULL AND btrim(audio_url) <> '')
  );

ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_voice_audio_check;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_voice_audio_check
  CHECK (
    comment_type = 'text'
    OR (audio_url IS NOT NULL AND btrim(audio_url) <> '')
  );

COMMENT ON COLUMN public.post_comments.comment_type IS
  'text | voice (audio seul) | text_voice (légende + note vocale)';

-- ─── reviews (avis produits) ─────────────────────────────────────────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS review_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_type_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_type_check
  CHECK (review_type IN ('text', 'voice', 'text_voice'));

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_payload_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_payload_check
  CHECK (
    (comment IS NOT NULL AND btrim(comment) <> '')
    OR (audio_url IS NOT NULL AND btrim(audio_url) <> '')
  );

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_voice_audio_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_voice_audio_check
  CHECK (
    review_type = 'text'
    OR (audio_url IS NOT NULL AND btrim(audio_url) <> '')
  );

-- ─── Storage : audio commentaires dans bucket posts (032 MIME déjà OK) ───────
-- Chemin applicatif : posts/{user_id}/comments/{timestamp}.webm
