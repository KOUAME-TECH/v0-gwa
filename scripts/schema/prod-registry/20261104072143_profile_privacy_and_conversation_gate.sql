-- Reconstitué depuis supabase_migrations.schema_migrations (prod frorfexbcyfbydkiwxqv)
-- version 20261104072143 · nom « profile_privacy_and_conversation_gate » · lu le 25/11/2026 (Africa/Abidjan)
-- DÉJÀ APPLIQUÉE EN PROD. Fichier documentaire : ne pas rejouer.

-- Coordonnées et secrets de compte : plus de lecture navigateur hors propriétaire.
REVOKE SELECT (
  email,
  phone,
  address,
  linked_email,
  onesignal_player_id,
  suspended_reason,
  suspended_by,
  coordonnees_gps,
  latitude,
  longitude,
  rccm_numero,
  commercial_contact,
  president_name,
  secretary_name,
  auth_method,
  phone_verified,
  email_linked_at,
  phone_linked_at
) ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.profile_self()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.profile_self() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_self() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_open_conversation(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND target IS NOT NULL
    AND target <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = target
        AND COALESCE(p.is_suspended, false) = false
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE (c.participant_1 = auth.uid() AND c.participant_2 = target)
           OR (c.participant_2 = auth.uid() AND c.participant_1 = target)
      )
      OR EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE (o.buyer_id = auth.uid() AND o.seller_id = target)
           OR (o.seller_id = auth.uid() AND o.buyer_id = target)
      )
      OR EXISTS (
        SELECT 1
        FROM public.products pr
        WHERE pr.seller_id = target
          AND pr.status = 'active'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_open_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_open_conversation(uuid) TO authenticated;

DROP POLICY IF EXISTS conversations_insert_own ON public.conversations;
CREATE POLICY conversations_insert_own
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      (SELECT auth.uid()) = participant_1
      AND public.can_open_conversation(participant_2)
    )
    OR (
      (SELECT auth.uid()) = participant_2
      AND public.can_open_conversation(participant_1)
    )
  );
