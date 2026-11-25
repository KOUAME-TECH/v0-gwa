-- 085 — SCG méthode des 5C (Caractère, Capacité, Capital, Collatéral, Conditions)
-- NON APPLIQUÉE. Ordre : 083 → 084 → 085, puis déploiement du code #71.
--
-- 1. scg_scores : 5 sous-scores 0–100 + version du modèle + explication (jsonb).
-- 2. public.scg_5c_inputs(uuid) : collecte en UNE requête toutes les données
--    utiles au 5C pour un utilisateur. SECURITY DEFINER, exécutable par
--    service_role UNIQUEMENT (cohérent avec 084 : le score n'est calculé et
--    écrit que côté serveur). Fonction en lecture seule (STABLE).
-- Le calcul des points est fait dans lib/scg/five-c.ts (testé, explicable).

BEGIN;

ALTER TABLE public.scg_scores
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS c_character  smallint,
  ADD COLUMN IF NOT EXISTS c_capacity   smallint,
  ADD COLUMN IF NOT EXISTS c_capital    smallint,
  ADD COLUMN IF NOT EXISTS c_collateral smallint,
  ADD COLUMN IF NOT EXISTS c_conditions smallint,
  ADD COLUMN IF NOT EXISTS explain      jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.scg_scores DROP CONSTRAINT IF EXISTS scg_scores_5c_range;
ALTER TABLE public.scg_scores ADD CONSTRAINT scg_scores_5c_range CHECK (
      (c_character  IS NULL OR c_character  BETWEEN 0 AND 100)
  AND (c_capacity   IS NULL OR c_capacity   BETWEEN 0 AND 100)
  AND (c_capital    IS NULL OR c_capital    BETWEEN 0 AND 100)
  AND (c_collateral IS NULL OR c_collateral BETWEEN 0 AND 100)
  AND (c_conditions IS NULL OR c_conditions BETWEEN 0 AND 100)
);

-- @@SCG_5C_INPUTS_BEGIN@@ (le corps est réutilisé tel quel par le dry-run en lecture seule)
CREATE OR REPLACE FUNCTION public.scg_5c_inputs(p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH
me AS (
  SELECT p.* FROM public.profiles p WHERE p.id = p_user
),
-- Acheteurs "liés" : même téléphone ou même email que le vendeur (anti-fraude)
linked AS (
  SELECT o.buyer_id FROM public.orders o
  JOIN public.profiles b ON b.id = o.buyer_id
  JOIN me ON true
  WHERE o.seller_id = p_user AND o.buyer_id <> p_user
    AND (
      (me.phone IS NOT NULL AND b.phone = me.phone)
      OR (lower(coalesce(me.email, me.linked_email, '')) <> ''
          AND lower(coalesce(b.email, b.linked_email, '')) = lower(coalesce(me.email, me.linked_email, '')))
    )
  GROUP BY o.buyer_id
),
s AS ( -- ventes "réelles" : hors auto-achat, hors comptes liés, hors brouillons
  SELECT o.*, coalesce(o.total_amount, 0)::numeric AS amt,
         coalesce(o.vendeur_recoit_fcfa, o.seller_net_amount, o.total_amount, 0)::numeric AS net
  FROM public.orders o
  WHERE o.seller_id = p_user AND o.buyer_id <> p_user
    AND o.buyer_id NOT IN (SELECT buyer_id FROM linked)
    AND o.status <> 'draft'
),
done AS (SELECT * FROM s WHERE s.status IN ('delivered', 'completed')),
buyer_share AS (
  SELECT max(x.v) / nullif(sum(x.v), 0) AS top_share, count(*) AS n
  FROM (SELECT buyer_id, sum(amt) v FROM done GROUP BY buyer_id) x
),
disp AS (
  SELECT d.* FROM public.disputes d JOIN public.orders o ON o.id = d.order_id
  WHERE o.seller_id = p_user AND d.opened_by <> p_user
),
rv AS ( -- avis reçus, hors auto-avis
  SELECT r.rating FROM public.reviews r
  LEFT JOIN public.products pr ON pr.id = r.product_id
  WHERE coalesce(r.seller_id, pr.seller_id) = p_user AND r.reviewer_id <> p_user
    AND r.parent_review_id IS NULL
),
rv_self AS (
  SELECT count(*) n FROM public.reviews r
  LEFT JOIN public.products pr ON pr.id = r.product_id
  WHERE coalesce(r.seller_id, pr.seller_id) = p_user AND r.reviewer_id = p_user
),
rep AS (
  SELECT r.* FROM public.reports r
  WHERE r.reported_id = p_user
     OR (r.reported_type = 'product' AND r.reported_id IN (SELECT id FROM public.products WHERE seller_id = p_user))
),
pay AS ( -- tranches de séquestre dues par l'utilisateur en tant qu'acheteur
  SELECT e.*, o.created_at AS order_created
  FROM public.escrow_transactions e JOIN public.orders o ON o.id = e.order_id
  WHERE o.buyer_id = p_user AND o.seller_id <> p_user
),
msg_in AS (
  SELECT m.id, m.created_at,
    (SELECT min(r.created_at) FROM public.messages r
      WHERE r.conversation_id = m.conversation_id AND r.sender_id = p_user
        AND r.created_at > m.created_at AND r.created_at <= m.created_at + interval '48 hours') AS replied_at
  FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
  WHERE (c.participant_1 = p_user OR c.participant_2 = p_user) AND m.sender_id <> p_user
    AND m.created_at > now() - interval '365 days'
),
prod AS ( -- offres publiées (pas de brouillon, pas de rejet modération)
  SELECT pr.* FROM public.products pr
  WHERE pr.seller_id = p_user AND pr.status IN ('active', 'sold_out', 'paused')
    AND coalesce(pr.offer_status, '') NOT IN ('brouillon', 'draft', 'expiree', 'archivee')
    AND coalesce(pr.moderation_status, 'approved') <> 'rejected'
),
coop AS (
  SELECT c.is_verified, c.validation_status, cm.contribution_percentage
  FROM public.cooperatives c
  LEFT JOIN public.cooperative_members cm ON cm.cooperative_id = c.id AND cm.user_id = p_user AND cm.is_active
  JOIN me ON true
  WHERE cm.id IS NOT NULL OR c.id = me.coop_id OR c.admin_id = p_user
  ORDER BY c.is_verified DESC NULLS LAST
  LIMIT 1
),
fil AS (
  SELECT f, count(*) n FROM (
    SELECT unnest(coalesce(me.filieres, '{}'::text[])) f FROM me
    UNION ALL SELECT prod.filiere FROM prod WHERE prod.filiere IS NOT NULL
  ) x WHERE f IS NOT NULL AND f <> '' GROUP BY f
)
SELECT jsonb_build_object( -- (5 blocs : limite de 100 arguments par fonction)
  'user_id', p_user,
  'exists', EXISTS (SELECT 1 FROM me),
  'user_type', (SELECT user_type FROM me),
  'account_age_days', coalesce((SELECT (now()::date - created_at::date) FROM me), 0)
) || jsonb_build_object(
  -- Caractère
  'kyc_verified', coalesce((SELECT is_verified FROM me), false)
     OR EXISTS (SELECT 1 FROM public.verification_requests v WHERE v.user_id = p_user AND v.request_type = 'user' AND v.status = 'approved'),
  'rccm_verified', coalesce((SELECT rccm_verified FROM me), false),
  'phone_verified', coalesce((SELECT phone_verified FROM me), false),
  'email_present', coalesce((SELECT coalesce(email, linked_email) IS NOT NULL FROM me), false),
  'is_suspended', coalesce((SELECT is_suspended FROM me), false),
  'reviews_count', (SELECT count(*) FROM rv),
  'reviews_avg', (SELECT round(avg(rating)::numeric, 2) FROM rv),
  'self_reviews', (SELECT n FROM rv_self),
  'orders_total', (SELECT count(*) FROM s WHERE s.status NOT IN ('pending')),
  'orders_completed', (SELECT count(*) FROM done),
  'orders_cancelled', (SELECT count(*) FROM s WHERE s.status = 'cancelled' AND s.payment_status IN ('paid', 'refunded')),
  'orders_late', (SELECT count(*) FROM done WHERE done.delivered_at IS NOT NULL
                    AND done.delivered_at > coalesce(done.delivery_deadline, done.estimated_delivery::timestamptz + interval '1 day')),
  'disputes_total', (SELECT count(*) FROM disp),
  'disputes_lost', (SELECT count(*) FROM disp WHERE disp.status = 'resolved_buyer' OR coalesce(disp.refund_amount, 0) > 0),
  'reports_upheld', (SELECT count(*) FROM rep WHERE rep.status = 'resolved'),
  'msgs_received', (SELECT count(*) FROM msg_in),
  'msgs_replied_48h', (SELECT count(*) FROM msg_in WHERE replied_at IS NOT NULL),
  'reply_median_minutes', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM replied_at - created_at) / 60)::numeric)
                             FROM msg_in WHERE replied_at IS NOT NULL),
  'courses_completed', (SELECT count(*) FROM public.course_progress cp WHERE cp.user_id = p_user AND cp.is_completed)
) || jsonb_build_object(
  -- Capacité
  'gmv_12m_fcfa', (SELECT coalesce(sum(amt), 0) FROM done WHERE done.created_at > now() - interval '365 days'),
  'orders_completed_12m', (SELECT count(*) FROM done WHERE done.created_at > now() - interval '365 days'),
  'active_months_12m', (SELECT count(DISTINCT date_trunc('month', created_at)) FROM done WHERE done.created_at > now() - interval '365 days'),
  'gmv_30d_fcfa', (SELECT coalesce(sum(amt), 0) FROM done WHERE done.created_at > now() - interval '30 days'),
  'gmv_prev_150d_fcfa', (SELECT coalesce(sum(amt), 0) FROM done WHERE done.created_at <= now() - interval '30 days' AND done.created_at > now() - interval '180 days'),
  'distinct_buyers', (SELECT n FROM buyer_share),
  'top_buyer_share', (SELECT round(top_share, 3) FROM buyer_share),
  'self_orders', (SELECT count(*) FROM public.orders o WHERE o.seller_id = p_user AND o.buyer_id = p_user),
  'linked_orders', (SELECT count(*) FROM public.orders o WHERE o.seller_id = p_user AND o.buyer_id IN (SELECT buyer_id FROM linked)),
  'buyer_tranches_due', (SELECT count(*) FROM pay WHERE pay.due_days IS NOT NULL),
  'buyer_tranches_late', (SELECT count(*) FROM pay WHERE pay.due_days IS NOT NULL
                            AND coalesce(pay.paid_at, now()) > pay.order_created + make_interval(days => pay.due_days))
) || jsonb_build_object(
  -- Capital
  'revenue_total_fcfa', (SELECT coalesce(sum(net), 0) FROM done),
  'stock_value_fcfa', (SELECT coalesce(sum(coalesce(prix_unitaire_fcfa, price, 0)::numeric
                            * greatest(coalesce(quantite_disponible_kg, stock_quantity::numeric, 0), 0)), 0) FROM prod),
  'coop_stock_qty', (SELECT coalesce(sum(cs.quantity), 0) FROM public.cooperative_stock cs
                       JOIN public.cooperative_members cm ON cm.id = cs.member_id WHERE cm.user_id = p_user),
  'surface_ha', (SELECT coalesce(surface_ha, nb_hectares_total, surface_area) FROM me),
  'storage_or_vehicle', coalesce((SELECT coalesce(capacite_stockage_tonnes, 0) > 0 OR coalesce(a_vehicule_transport, false) FROM me), false),
  'activity_start_year', (SELECT coalesce(annee_debut_activite,
                            CASE WHEN experience_years IS NOT NULL THEN extract(year FROM now())::int - experience_years END) FROM me)
) || jsonb_build_object(
  -- Collatéral
  'escrow_held_fcfa', (SELECT coalesce(sum(amt), 0) FROM s
                         WHERE s.payment_status = 'paid' AND coalesce(s.escrow_status, '') NOT IN ('released', 'refunded')
                           AND s.status NOT IN ('cancelled', 'disputed', 'completed', 'delivered')),  -- payée, pas encore livrée (livrée = créance)
  'receivables_fcfa', (SELECT coalesce(sum(net), 0) FROM done
                         WHERE coalesce(done.payout_status, '') NOT IN ('paid', 'released', 'success', 'succeeded', 'completed')
                           AND coalesce(done.escrow_status, '') NOT IN ('released', 'refunded')),
  'factoring_outstanding_fcfa', (SELECT coalesce(sum(amount_fcfa), 0) FROM public.factoring_requests f
                                   WHERE f.requester_id = p_user AND f.status IN ('pending', 'approved', 'disbursed')),
  'coop_member', EXISTS (SELECT 1 FROM coop),
  'coop_verified', coalesce((SELECT coalesce(is_verified, false) OR validation_status = 'qualified' FROM coop), false),
  'gps_parcels', (SELECT count(*) FROM public.user_places up WHERE up.user_id = p_user AND up.place_type = 'champ'
                    AND up.latitude IS NOT NULL AND up.longitude IS NOT NULL)
                 + (SELECT count(*) FROM me WHERE coordonnees_gps IS NOT NULL OR (latitude IS NOT NULL AND longitude IS NOT NULL))
                 + (SELECT count(*) FROM prod WHERE prod.coordonnees_gps IS NOT NULL),
  'certifications', (SELECT (CASE WHEN coalesce(certif_bio, false) THEN 1 ELSE 0 END)
                           + (CASE WHEN coalesce(certif_fairtrade, false) THEN 1 ELSE 0 END) FROM me)
                    + (SELECT count(DISTINCT c) FROM prod, unnest(coalesce(prod.certifications, '{}'::text[])) c)
) || jsonb_build_object(
  -- Conditions
  'main_filiere', (SELECT f FROM fil ORDER BY n DESC, f LIMIT 1),
  'filieres_count', (SELECT count(*) FROM fil),
  'country', (SELECT country FROM me),
  'country_supported', EXISTS (SELECT 1 FROM public.country_configs cc JOIN me ON true
                                 WHERE cc.is_active AND (
                                   upper(cc.country_code) = upper(coalesce(me.country, 'CI'))
                                   OR (upper(cc.country_code) = 'CI' AND (me.country ILIKE 'c_te d_ivoire%' OR me.country ILIKE 'ivory coast%'))
                                 )),
  'region_known', coalesce((SELECT city IS NOT NULL OR coalesce(array_length(zones_production, 1), 0) > 0 FROM me), false)
                  OR EXISTS (SELECT 1 FROM prod WHERE coalesce(prod.region, prod.origin_region) IS NOT NULL),
  'price_gap_pct', (SELECT round(avg(abs(coalesce(prix_unitaire_fcfa, price)::numeric - prix_ocpv_ref_fcfa) * 100 / prix_ocpv_ref_fcfa), 1)
                      FROM prod WHERE prod.prix_ocpv_ref_fcfa > 0 AND coalesce(prix_unitaire_fcfa, price) IS NOT NULL),
  'subscription_tier', (SELECT coalesce(subscription_tier, 'free') FROM me)
);
$fn$;
-- @@SCG_5C_INPUTS_END@@

REVOKE ALL ON FUNCTION public.scg_5c_inputs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scg_5c_inputs(uuid) TO service_role;

COMMENT ON FUNCTION public.scg_5c_inputs(uuid) IS
  'SCG 5C : données d''entrée d''un utilisateur (lecture seule). service_role uniquement. Voir docs/scg-5c.md.';

COMMIT;

-- Post-contrôles (lecture seule) :
-- SELECT has_function_privilege('authenticated', 'public.scg_5c_inputs(uuid)', 'EXECUTE');  -- attendu : false
-- SELECT has_function_privilege('anon', 'public.scg_5c_inputs(uuid)', 'EXECUTE');           -- attendu : false
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'scg_scores' AND column_name LIKE 'c\_%';
