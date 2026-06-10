-- Fix the post_type check constraint to accept all needed values
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_post_type_check 
  CHECK (post_type IN ('post', 'story', 'repost', 'general', 'media', 'question', 'astuce', 'temoignage', 'annonce'));

-- Update existing default
ALTER TABLE public.posts ALTER COLUMN post_type SET DEFAULT 'post';

-- Drop orphan tables from old chat system
DROP TABLE IF EXISTS public.room_members CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

-- Also drop any leftover triggers referencing room_id
DROP TRIGGER IF EXISTS on_new_message ON public.messages;
DROP TRIGGER IF EXISTS on_message_insert ON public.messages;
DROP FUNCTION IF EXISTS public.handle_new_message() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_message() CASCADE;
