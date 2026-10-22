-- 061 — Keep legacy non-agricultural rows stored but outside the beta catalogue.
DROP POLICY IF EXISTS "products_select_all" ON public.products;
CREATE POLICY "products_select_beta_scope"
  ON public.products
  FOR SELECT
  USING (
    product_type = 'agriculture'
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.admin_roles ar
      WHERE ar.user_id = auth.uid()
        AND ar.is_active = true
    )
  );

DROP POLICY IF EXISTS "products_insert_own" ON public.products;
CREATE POLICY "products_insert_own"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND product_type = 'agriculture'
  );

DROP POLICY IF EXISTS "products_update_own" ON public.products;
CREATE POLICY "products_update_own"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = seller_id
    AND product_type = 'agriculture'
  )
  WITH CHECK (
    auth.uid() = seller_id
    AND product_type = 'agriculture'
  );

DROP POLICY IF EXISTS "products_delete_own" ON public.products;
CREATE POLICY "products_delete_own"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = seller_id
    AND product_type = 'agriculture'
  );
