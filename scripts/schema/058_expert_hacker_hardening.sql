-- 058 — Expert-hacker residual hardening
-- Storage path ownership, signup user_type lock, atomic stock, withdrawal uniqueness

-- ─── 1) Storage: uploads must be under {auth.uid()}/… ───────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload posts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cooperatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload community" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload orders" ON storage.objects;

-- Drop prior hardening policies if re-run
DROP POLICY IF EXISTS "products_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "products_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "products_delete_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "posts_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "cooperatives_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "community_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "orders_insert_own_folder" ON storage.objects;

CREATE POLICY "products_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "products_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'products' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "products_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "posts_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'posts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "avatars_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat_media_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "cooperatives_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cooperatives'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "community_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "documents_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "orders_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'orders'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 2) handle_new_user: never accept cooperative from metadata ─────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type text;
  v_full_name text;
BEGIN
  v_user_type := lower(COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'acheteur'));
  IF v_user_type NOT IN ('acheteur', 'producteur') THEN
    v_user_type := 'acheteur';
  END IF;
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'Utilisateur'
  );

  INSERT INTO public.profiles (
    id, email, full_name, user_type, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_user_type,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    user_type = CASE
      WHEN EXCLUDED.user_type IN ('acheteur', 'producteur') THEN EXCLUDED.user_type
      ELSE profiles.user_type
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ─── 3) Atomic stock decrement (TOCTOU fix) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id uuid,
  p_qty integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'invalid_qty';
  END IF;

  UPDATE public.products
  SET
    stock_quantity = stock_quantity - p_qty,
    updated_at = now()
  WHERE id = p_product_id
    AND stock_quantity IS NOT NULL
    AND stock_quantity >= p_qty
  RETURNING stock_quantity INTO v_left;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.products
      WHERE id = p_product_id AND stock_quantity IS NULL
    ) THEN
      RETURN NULL;
    END IF;
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  RETURN v_left;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO authenticated;

-- ─── 4) At most one open withdrawal per user (si table présente) ────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_withdrawals'
  ) THEN
    EXECUTE $i$
      CREATE UNIQUE INDEX IF NOT EXISTS wallet_withdrawals_one_open_per_user
        ON public.wallet_withdrawals (user_id)
        WHERE status IN ('pending', 'processing', 'queued')
    $i$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'withdrawals'
  ) THEN
    EXECUTE $i$
      CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_one_open_per_user
        ON public.withdrawals (user_id)
        WHERE status IN ('pending', 'processing', 'queued')
    $i$;
  END IF;
END $$;

-- ─── 5) Re-issue weak invite codes ───────────────────────────────────────────
UPDATE public.cooperatives
SET invite_code = encode(gen_random_bytes(12), 'hex')
WHERE invite_code IS NULL
   OR invite_code ~ '^gwa-[0-9a-f]{12}$'
   OR length(invite_code) < 16;
