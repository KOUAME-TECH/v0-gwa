-- 080 — Module 6 : INSERT storage limité au dossier de l'utilisateur (<auth.uid()>/...). Idempotent.

DROP POLICY IF EXISTS "Authenticated users can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload posts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cooperatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload community" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_own_folder" ON storage.objects;

CREATE POLICY "storage_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('products', 'posts', 'avatars', 'chat-media', 'cooperatives', 'community')
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
