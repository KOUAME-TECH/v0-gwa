-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('products', 'products', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp']),
  ('posts', 'posts', true, 10485760, ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4']),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/gif','image/webp']),
  ('chat-media', 'chat-media', true, 10485760, ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('cooperatives', 'cooperatives', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp']),
  ('community', 'community', true, 10485760, ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow authenticated users to upload
CREATE POLICY "Authenticated users can upload products" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

CREATE POLICY "Authenticated users can upload posts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload chat media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Authenticated users can upload cooperatives" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cooperatives');

CREATE POLICY "Authenticated users can upload community" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community');

-- Everyone can read public buckets
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id IN ('products', 'posts', 'avatars', 'chat-media', 'cooperatives', 'community'));
