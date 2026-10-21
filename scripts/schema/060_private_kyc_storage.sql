-- 060 — Store new identity documents outside the public avatars bucket.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "KYC owners upload their documents" ON storage.objects;
CREATE POLICY "KYC owners upload their documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "KYC owners and admins read documents" ON storage.objects;
CREATE POLICY "KYC owners and admins read documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.admin_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.is_active = true
      )
    )
  );
