-- 078 — Chat privé (mark_messages_read), file SCG, durcissement trigger commandes.
-- Réécriture après NO-GO QA sur 078@65e11c6 (#54) : voir revue-pr54.md (25/11/2026).
--
-- Corrections par rapport à l'ancienne 078 :
-- 1. Transaction unique BEGIN/COMMIT + gardes en tête.
-- 2. Pas d'alias get_own_profile() (redondant avec profile_self, déjà en prod).
-- 3. §4 : on ne fait PAS de REVOKE UPDATE table sur orders (les routes
--    authentifiées mettent encore à jour des colonnes non financières).
--    On ne fait PAS non plus un REVOKE colonne seul (inefficace tant que
--    UPDATE table reste accordé à authenticated). Le trigger
--    protect_order_privileged_columns (068/065, déjà en prod) est étendu
--    pour figer aussi payment_reference. Les colonnes financières listées
--    dans l'ancienne 078 sont déjà protégées par ce trigger.
-- 4. Aucune politique storage : chat-media est déjà public=false ; les
--    policies d'upload existent sous *_insert_own_folder /
--    chat_media_insert_own_folder. Ne pas recréer "Public read access"
--    (absente en prod) ni les anciens noms d'upload.
-- 5. mark_messages_read + suppression de messages_update_participant :
--    plus AUCUNE policy UPDATE sur messages pour authenticated (correctif
--    QA Lot C §6.1 : une policy limite les lignes, pas les colonnes ; avec
--    messages_update_own_unread un expéditeur pouvait encore réécrire
--    content / conversation_id, et donc s'auto-accepter une offre de prix).
--    Les deux seules écritures UPDATE légitimes du client passent par des
--    RPC SECURITY DEFINER à colonnes fixes :
--      - mark_messages_read(conversation)      : is_read, status, read_at
--      - respond_to_price_offer(message, statut): statut d'une offre reçue
-- 6bis. Garde : RLS doit être actif sur messages (sinon l'absence de policy
--    ne protège rien).
-- 6. scg_events_queue : FK, garde d'existence, GRANT service_role uniquement.
--
-- NON APPLIQUÉE EN PROD tant que QA n'a pas donné son GO et Yao le go écrit
-- nommant ce fichier. Ordre : 02, 03a, 065, 076, 077, 079 (déjà posées)
-- puis 078.

BEGIN;

DO $gwa078_guard$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION '078: table public.messages requise';
  END IF;
  IF to_regclass('public.conversations') IS NULL THEN
    RAISE EXCEPTION '078: table public.conversations requise';
  END IF;
  IF to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION '078: table public.orders requise';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION '078: table public.profiles requise';
  END IF;
  IF to_regprocedure('public.protect_order_privileged_columns()') IS NULL THEN
    RAISE EXCEPTION '078: trigger function protect_order_privileged_columns requise (065)';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.messages'::regclass) THEN
    RAISE EXCEPTION '078: RLS doit être actif sur public.messages';
  END IF;
END
$gwa078_guard$;

-- 1. Lecture groupée des messages reçus, sans UPDATE direct du contenu d'autrui.
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

COMMENT ON FUNCTION public.mark_messages_read(uuid) IS
  '078: marque lus les messages reçus d''une conversation dont l''appelant est participant.';

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated, service_role;

-- 1bis. Réponse à une offre de prix reçue (accepter / refuser).
--   Seul le destinataire (participant, non expéditeur) peut répondre, une
--   seule fois (statut courant = pending). Seul le champ JSON "status" de
--   content change ; montant, produit, conversation, expéditeur sont figés.
CREATE OR REPLACE FUNCTION public.respond_to_price_offer(p_message_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg record;
  v_payload jsonb;
  v_content text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT m.id, m.sender_id, m.content, m.message_type, c.participant_1, c.participant_2
    INTO v_msg
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE m.id = p_message_id
  FOR UPDATE OF m;

  IF NOT FOUND
     OR auth.uid() NOT IN (v_msg.participant_1, v_msg.participant_2)
     OR v_msg.sender_id = auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_msg.message_type IS DISTINCT FROM 'offer' THEN
    RAISE EXCEPTION 'not_an_offer';
  END IF;

  BEGIN
    v_payload := v_msg.content::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'not_an_offer';
  END;
  IF v_payload->>'kind' IS DISTINCT FROM 'price_offer' THEN
    RAISE EXCEPTION 'not_an_offer';
  END IF;
  IF coalesce(v_payload->>'status', 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'offer_already_answered';
  END IF;

  v_content := jsonb_set(v_payload, '{status}', to_jsonb(p_status))::text;

  UPDATE public.messages
  SET content = v_content,
      is_edited = true
  WHERE id = p_message_id;

  RETURN v_content;
END;
$$;

COMMENT ON FUNCTION public.respond_to_price_offer(uuid, text) IS
  '078: le destinataire d''une offre de prix pending l''accepte ou la refuse (seul le statut change).';

REVOKE ALL ON FUNCTION public.respond_to_price_offer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_price_offer(uuid, text) TO authenticated, service_role;

-- 1ter. Aucune policy UPDATE sur messages : RLS refuse tout UPDATE direct
--   par authenticated/anon ; seules les RPC ci-dessus écrivent.
DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own_unread" ON public.messages;

-- 2. Ledger : idempotent (déjà service_role only en prod après 03a).
REVOKE INSERT, UPDATE, DELETE ON public.financial_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_ledger TO service_role;

-- 3. Étendre le trigger 065 : figer aussi payment_reference.
--    Pas de REVOKE UPDATE au niveau table (casserait les flux authenticated).
CREATE OR REPLACE FUNCTION public.protect_order_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    auth.role()
  );
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.payment_status := OLD.payment_status;
  NEW.escrow_status := OLD.escrow_status;
  NEW.payout_status := OLD.payout_status;
  NEW.payout_ref := OLD.payout_ref;
  NEW.payout_at := OLD.payout_at;
  NEW.payout_error := OLD.payout_error;
  NEW.payout_network := OLD.payout_network;
  NEW.total_amount := OLD.total_amount;
  NEW.subtotal := OLD.subtotal;
  NEW.shipping_cost := OLD.shipping_cost;
  NEW.service_fee := OLD.service_fee;
  NEW.commission_pct := OLD.commission_pct;
  NEW.commission_fcfa := OLD.commission_fcfa;
  NEW.vendeur_recoit_fcfa := OLD.vendeur_recoit_fcfa;
  NEW.buyer_id := OLD.buyer_id;
  NEW.seller_id := OLD.seller_id;
  NEW.product_price := OLD.product_price;
  NEW.buyer_service_fee := OLD.buyer_service_fee;
  NEW.seller_commission := OLD.seller_commission;
  NEW.seller_net_amount := OLD.seller_net_amount;
  NEW.pricing_plan_id := OLD.pricing_plan_id;
  NEW.commission_rate_applied := OLD.commission_rate_applied;
  NEW.lifecycle_status := OLD.lifecycle_status;
  NEW.currency := OLD.currency;
  NEW.provider_reference := OLD.provider_reference;

  BEGIN
    NEW.payment_reference := OLD.payment_reference;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  -- Colonnes ajoutées par 077 : no-op si absentes.
  BEGIN
    NEW.payout_fee_frozen_fcfa := OLD.payout_fee_frozen_fcfa;
    NEW.payout_plan_id_at_payment := OLD.payout_plan_id_at_payment;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;

  IF OLD.status NOT IN ('pending') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. File d'événements SCG (écriture service_role uniquement).
CREATE TABLE IF NOT EXISTS public.scg_events_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  order_id uuid REFERENCES public.orders(id),
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scg_events_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scg_events_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.scg_events_queue TO service_role;

COMMIT;
