-- 032_media_video_audio.sql
-- GWA — Médias enrichis : vidéo + note vocale (audio) sur produits et publications.
-- Objectif : permettre aux utilisateurs qui ne savent pas écrire de publier une photo
-- accompagnée d'une note vocale, et d'ajouter une courte vidéo à une offre/publication.

-- 1) Colonnes médias
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS audio_url text;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS audio_url text;

-- 2) Buckets storage : autoriser vidéo/audio + relever la limite de taille à 50 Mo.
--    Les buckets 'products' et 'posts' existent déjà et sont publics.
UPDATE storage.buckets
SET
  file_size_limit = 52428800, -- 50 Mo
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/aac','audio/x-m4a','audio/mp3'
  ]
WHERE id IN ('products','posts');
