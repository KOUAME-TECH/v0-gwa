-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20260810024651 · nom « anti_speculation_hardening_057 » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

-- 057_anti_speculation_hardening.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

UPDATE public.cooperatives
SET invite_code = COALESCE(NULLIF(invite_code, ''), 'gwa-' || substr(replace(id::text, '-', ''), 1, 12))
WHERE invite_code IS NULL OR invite_code = '';

REVOKE SELECT (
  email,
  phone,
  linked_email,
  address,
  suspended_reason,
  suspended_at,
  suspended_by,
  onesignal_player_id
) ON public.profiles FROM anon;

REVOKE SELECT (
  email,
  phone,
  linked_email,
  address,
  suspended_reason,
  suspended_at,
  suspended_by,
  onesignal_player_id
) ON public.profiles FROM authenticated;

GRANT SELECT (
  email,
  phone,
  linked_email,
  address,
  suspended_reason,
  suspended_at,
  suspended_by,
  onesignal_player_id
) ON public.profiles TO service_role;

CREATE OR REPLACE VIEW public.profiles_self_pii
WITH (security_invoker = true) AS
SELECT
  id,
  email,
  phone,
  linked_email,
  address,
  onesignal_player_id
FROM public.profiles
WHERE id = auth.uid();

GRANT SELECT ON public.profiles_self_pii TO authenticated;

DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_reviewer_unique
  ON public.reviews (order_id, reviewer_id)
  WHERE order_id IS NOT NULL AND rating >= 1;

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.buyer_id = auth.uid()
        AND (
          o.status = 'delivered'
          OR o.escrow_status = 'released'
        )
    )
  );
