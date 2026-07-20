-- 037_profiles_pii_restrict.sql
-- Post-bêta urgent : restreindre la lecture PII (email/phone) cross-users.
-- profiles_public reste la vue marketplace ; colonnes PII hors GRANT authenticated large.

-- 1) Révoquer lecture PII large pour authenticated (027 l'avait accordée)
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

-- 2) Garder SELECT de base sur profiles pour embeds (sans PII via GRANT colonne)
-- Les colonnes non-PII restent accessibles via la policy profiles_select_all.
-- Le propriétaire lit ses PII via policy dédiée (GRANT + USING own).

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

-- 3) Vue own-PII pour l'utilisateur connecté (lecture de SON profil complet côté client)
CREATE OR REPLACE VIEW public.profiles_self_pii
WITH (security_invoker = true) AS
SELECT
  id,
  email,
  phone,
  linked_email,
  address,
  suspended_reason,
  suspended_at,
  suspended_by
FROM public.profiles
WHERE id = auth.uid();

GRANT SELECT ON public.profiles_self_pii TO authenticated;

COMMENT ON VIEW public.profiles_self_pii IS
  'PII du profil courant uniquement. Admin lit PII via /api/admin/* (service_role).';
