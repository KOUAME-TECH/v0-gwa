-- Sécurité des modules auth, commandes, chat et stockage.
-- À appliquer manuellement sur la base de production.

-- 1. Alias de lecture du profil connecté (contourne le retrait des colonnes PII).
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profile_self();
$$;

REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated, service_role;

-- 2. Lecture groupée des messages reçus, sans UPDATE direct du contenu d'autrui.
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.messages
  SET is_read = true,
      status = 'read',
      read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id IS DISTINCT FROM auth.uid()
    AND is_read IS NOT TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own_unread" ON public.messages;
CREATE POLICY "messages_update_own_unread"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = (SELECT auth.uid()) AND is_read IS NOT TRUE)
  WITH CHECK (sender_id = (SELECT auth.uid()));

-- 3. Le grand livre n'est pas writable par les rôles publics.
REVOKE INSERT, UPDATE, DELETE ON public.financial_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_ledger TO service_role;

-- 4. Colonnes financières d'une commande : plus d'UPDATE par un participant.
REVOKE UPDATE (
  payment_reference,
  provider_reference,
  total_amount,
  seller_commission,
  seller_net_amount,
  commission_fcfa,
  status,
  escrow_status,
  payment_status,
  payout_status
) ON public.orders FROM PUBLIC, anon, authenticated;

-- 5. Médias de chat privés.
UPDATE storage.buckets
SET public = false
WHERE id = 'chat-media';

DROP POLICY IF EXISTS "Public read access" ON storage.objects;
CREATE POLICY "Public read access"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id IN ('products', 'posts', 'avatars', 'cooperatives', 'community'));

-- 6. Upload uniquement dans le dossier de l'utilisateur.
DROP POLICY IF EXISTS "Authenticated users can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload posts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cooperatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload community" ON storage.objects;

CREATE POLICY "Authenticated users can upload products" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can upload posts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can upload chat media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can upload cooperatives" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cooperatives' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can upload community" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 7. File d'événements SCG.
CREATE TABLE IF NOT EXISTS public.scg_events_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scg_events_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scg_events_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.scg_events_queue TO service_role;
