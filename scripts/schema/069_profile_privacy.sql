-- Coordonnées et secrets de compte : plus de lecture navigateur hors propriétaire.
-- Le propriétaire passe par profile_self() (security definer).
-- Une conversation neuve n'est ouverte qu'avec un vendeur actif, une commande, ou un fil déjà là.

-- Le GRANT SELECT de table couvre toutes les colonnes. On le retire,
-- puis on ne rend que les colonnes publiques.
REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id,
  full_name,
  avatar_url,
  bio,
  user_type,
  country,
  city,
  is_verified,
  rating,
  total_reviews,
  production_type,
  surface_area,
  craft_type,
  experience_years,
  member_count,
  registration_number,
  created_at,
  updated_at,
  is_suspended,
  scg_criteria,
  scg_score,
  onboarding_completed,
  interests,
  scg_badge,
  scg_bancable,
  scg_calculated_at,
  sub_type,
  profile_completion_pct,
  preferred_language,
  onboarding_completed_at,
  surface_ha,
  filieres,
  mode_culture,
  certif_bio,
  certif_fairtrade,
  annee_debut_activite,
  rccm_verified,
  nb_membres,
  nb_hectares_total,
  coop_type,
  zones_production,
  capacite_stockage_tonnes,
  a_vehicule_transport,
  coop_id,
  subscription_tier,
  digest_enabled,
  digest_last_sent_at,
  subscription_expires_at,
  pricing_plan_id
) ON TABLE public.profiles TO anon, authenticated;

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
