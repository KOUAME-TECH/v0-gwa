-- 057_anti_speculation_hardening.sql
-- PII restrict + messages/reviews RLS + abo expiry + coop invite + reviews unique

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE public.cooperatives
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

UPDATE public.cooperatives
SET invite_code = COALESCE(NULLIF(invite_code, ''), 'gwa-' || substr(replace(id::text, '-', ''), 1, 12))
WHERE invite_code IS NULL OR invite_code = '';

-- PII : révoquer lecture email/phone cross-users (anon + authenticated)
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

-- Vue own-PII (security definer : colonnes révoquées sur la table)
DROP VIEW IF EXISTS public.profiles_self_pii;
CREATE VIEW public.profiles_self_pii AS
SELECT
  id,
  email,
  phone,
  linked_email,
  address,
  onesignal_player_id
FROM public.profiles
WHERE id = auth.uid();
ALTER VIEW public.profiles_self_pii OWNER TO postgres;
GRANT SELECT ON public.profiles_self_pii TO authenticated;
GRANT SELECT ON public.profiles_self_pii TO service_role;

-- Messages : seul l'auteur peut UPDATE (anti forge offre)
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Reviews : unique + insert lié commande livrée
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

COMMENT ON COLUMN public.profiles.subscription_expires_at IS
  'Fin d’abo payant (30j). Null/expiré → droits FREE côté API effectiveTier.';
COMMENT ON COLUMN public.cooperatives.invite_code IS
  'Code requis pour /api/cooperatives/join (anti-gonflage membres).';
