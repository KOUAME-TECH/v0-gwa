-- ROLLBACK 078 — retour à l'état d'avant 078_security_modules.sql.
-- EXÉCUTION : par un humain, dans l'éditeur SQL de Supabase. ROLLBACK par défaut ;
-- COMMIT uniquement sur go explicite de Yao pour cette exécution.
-- Ordre inverse de 078.

BEGIN;

-- 4. Policies d'upload : retour aux règles de 009 (sans préfixe {uid}/).
DROP POLICY IF EXISTS "Authenticated users can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload posts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cooperatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload community" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;

CREATE POLICY "Authenticated users can upload products" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'products');
CREATE POLICY "Authenticated users can upload posts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'posts');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload chat media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media');
CREATE POLICY "Authenticated users can upload cooperatives" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cooperatives');
CREATE POLICY "Authenticated users can upload community" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'community');

-- 3. chat-media redevient public (état 066).
UPDATE storage.buckets SET public = true WHERE id = 'chat-media';

-- 2. orders : retour à l'UPDATE niveau table pour authenticated.
--    ATTENTION : vérifier la photo des droits prise au §0 de 078 avant COMMIT ; si
--    anon n'avait pas UPDATE avant 078, ne pas le lui rendre.
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE ON public.orders TO authenticated;

-- 1. RPC de lecture groupée (le client retombe sur l'UPDATE direct de 066).
DROP FUNCTION IF EXISTS public.mark_messages_read(uuid);

ROLLBACK;  -- COMMIT uniquement sur go explicite de Yao pour cette exécution
