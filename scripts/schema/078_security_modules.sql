-- 078_security_modules.sql — Sécurité des modules chat, commandes et stockage.
-- Réécrite le 25/11/2026 (Africa/Abidjan, UTC+0) sur main a53e021, après le NO-GO QA de #54.
--
-- EXÉCUTION : par un humain, dans l'éditeur SQL de Supabase. PAS par un agent via MCP.
-- Répétition à blanc obligatoire : BEGIN … ROLLBACK, d'abord sur une copie/branche.
-- ROLLBACK par défaut. COMMIT uniquement sur go explicite de Yao nommant 078 pour CETTE
--   exécution (relayé par le Coordinateur, qui ne l'approuve pas lui-même).
-- Retour arrière : 078_security_modules.rollback.sql
-- Ordre : après 02-revoke-elargi, 03a, 065, 076, 077, 079 (078 n'en dépend pas, mais ne
--   doit pas passer avant 02 : 02 contrôle les ACL de fonctions).
--
-- Différences avec la 078 de #54 (65e11c6), à la demande de QA :
--   * transaction explicite BEGIN … ROLLBACK ;
--   * pas de GRANT DELETE/UPDATE sur financial_ledger à service_role, ni de REVOKE en
--     doublon de l'étape 02 : on se contente de VÉRIFIER l'état attendu (§0) ;
--   * §4 effectif : REVOKE UPDATE au niveau table pour anon/authenticated, puis GRANT
--     UPDATE colonne par colonne sur les seules colonnes non financières (un REVOKE au
--     niveau colonne n'a aucun effet tant que le privilège table existe) ;
--   * stockage aligné sur 035 et 066 : pas de recréation de "Public read access" (supprimée
--     par 035), chat-media garde chat_media_insert_own_folder (066) ;
--   * policy messages_update_participant (066) conservée : le destinataire d'une offre
--     met encore à jour le message (respondToOffer). Le resserrement viendra avec une RPC
--     de réponse aux offres.
--   * get_own_profile() retirée (alias inutile de profile_self, cf. 076) ;
--   * scg_events_queue retirée (utilisée seulement par les routes d'escrow retirées).

BEGIN;

-- ---------- 0. Pré-contrôles (lecture seule) ----------
DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL OR to_regclass('public.messages') IS NULL
     OR to_regclass('public.conversations') IS NULL THEN
    RAISE EXCEPTION 'Tables orders/messages/conversations attendues';
  END IF;
  -- Étape 02 / 03a : le grand livre n'est pas modifiable par les rôles publics.
  IF to_regclass('public.financial_ledger') IS NOT NULL AND (
       has_table_privilege('anon', 'public.financial_ledger', 'INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated', 'public.financial_ledger', 'INSERT,UPDATE,DELETE')
  ) THEN
    RAISE EXCEPTION 'financial_ledger modifiable par anon/authenticated : appliquer l''étape 02 avant 078';
  END IF;
END $$;

-- Photo des droits UPDATE sur orders (à copier dans le PV d'exécution).
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'orders'
  AND grantee IN ('anon', 'authenticated') AND privilege_type = 'UPDATE'
ORDER BY grantee, column_name;

-- ---------- 1. Lecture groupée des messages reçus ----------
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

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated, service_role;

-- ---------- 2. Commandes : plus d'UPDATE des colonnes financières par un participant ----------
-- Un REVOKE UPDATE (col) est sans effet si le privilège UPDATE existe au niveau table :
-- on retire l'UPDATE table puis on ré-accorde colonne par colonne tout SAUF les colonnes
-- financières. service_role (routes serveur, RPC) n'est pas touché.
-- ATTENTION ordre applicatif : sur main a53e021, confirm-delivery et release écrivent
-- encore escrow_status avec le client utilisateur (aujourd'hui neutralisé en silence par
-- le trigger 065). Après 078 ces UPDATE échouent en 42501 : appliquer 078 seulement
-- après la pile #49/#57, qui passe ces routes par les RPC serveur.
REVOKE UPDATE ON public.orders FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'orders'
    AND column_name NOT IN (
      -- identité de la commande
      'id', 'buyer_id', 'seller_id', 'created_at',
      -- paiement / références prestataire
      'payment_reference', 'provider_reference', 'feexpay_ref', 'payment_method', 'currency',
      'payment_status', 'escrow_status',
      -- montants (mêmes colonnes que protect_order_privileged_columns, 065)
      'total_amount', 'subtotal', 'shipping_cost', 'service_fee', 'commission_pct',
      'commission_fcfa', 'seller_commission', 'seller_net_amount', 'vendeur_recoit_fcfa',
      -- reversement
      'payout_status', 'payout_ref', 'payout_network', 'payout_at', 'payout_error'
      -- status reste modifiable au niveau colonne : le trigger 065 le fige hors 'pending'
      -- pour les non-admins ; le révoquer casserait shipment/litige (UPDATE client).
    );
  IF v_cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.orders TO authenticated', v_cols);
  END IF;
END $$;

-- Post-contrôle §2 : aucune colonne financière modifiable par anon/authenticated.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(r.rolname || ':' || c.column_name, ', ')
    INTO v_bad
  FROM information_schema.columns c
  CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
  WHERE c.table_schema = 'public' AND c.table_name = 'orders'
    AND c.column_name IN (
      'payment_reference', 'provider_reference', 'total_amount', 'seller_commission',
      'seller_net_amount', 'commission_fcfa', 'escrow_status', 'payment_status',
      'payout_status', 'buyer_id', 'seller_id'
    )
    AND has_column_privilege(r.rolname, 'public.orders', c.column_name, 'UPDATE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Colonnes financières encore modifiables : %', v_bad;
  END IF;
  IF has_table_privilege('anon', 'public.orders', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.orders', 'UPDATE') THEN
    RAISE EXCEPTION 'UPDATE niveau table encore présent sur orders';
  END IF;
END $$;

-- ---------- 3. Médias de chat privés (lecture par lien signé uniquement) ----------
-- 066 a laissé le bucket public : les URL /object/public/chat-media/... restent lisibles
-- par n'importe qui. La lecture passe désormais par chat_media_select_participants (066)
-- et des liens signés (app/api/chat/media/sign, lib/chat/upload.ts).
UPDATE storage.buckets
SET public = false
WHERE id = 'chat-media';

-- Pas de policy "Public read access" : supprimée par 035 (listing de buckets entiers).

-- ---------- 4. Upload uniquement dans le dossier de l'utilisateur ----------
-- Les policies d'upload de 009 n'imposent pas le préfixe {uid}/.
DROP POLICY IF EXISTS "Authenticated users can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload posts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cooperatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload community" ON storage.objects;
-- chat-media : la policy large de 009 est retirée ; chat_media_insert_own_folder (066,
-- dossier uid + participant de la conversation) reste la seule règle d'INSERT.
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;

CREATE POLICY "Authenticated users can upload products" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Authenticated users can upload posts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Authenticated users can upload cooperatives" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cooperatives' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Authenticated users can upload community" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'chat_media_insert_own_folder'
  ) THEN
    RAISE EXCEPTION 'chat_media_insert_own_folder (066) absente : appliquer 066 avant 078';
  END IF;
END $$;

ROLLBACK;  -- COMMIT uniquement sur go explicite de Yao nommant 078 pour cette exécution
