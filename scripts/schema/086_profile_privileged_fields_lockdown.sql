-- 086 — Champs privilégiés de profiles : jamais posés ni modifiés par le membre lui-même.
-- NON APPLIQUÉE. Ordre : 083 → 084 → 085 → 086, puis déploiement du code #71.
--
-- Règle : si la requête vient d'une session membre (rôle JWT anon / authenticated) :
--   - INSERT : les champs privilégiés prennent leur valeur par défaut (ferme le chemin
--     « supprimer son profil puis le recréer avec is_verified = true, subscription_tier = 'pro'… ») ;
--   - UPDATE : les champs privilégiés gardent leur ancienne valeur.
-- Le service role (routes serveur, admin) et les contextes internes sans JWT
-- (trigger d'inscription handle_new_user exécuté par Supabase Auth, cron, migrations) ne sont pas bridés.
--
-- Inventaire des champs privilégiés (voir aussi lib/profile/privileged.ts) :
--   rôle        : user_type, sub_type, coop_id
--   identité    : is_verified, rccm_verified, phone, phone_verified, phone_linked_at, email_linked_at
--   suspension  : is_suspended, suspended_reason, suspended_at, suspended_by
--   abonnement  : subscription_tier, subscription_expires_at, pricing_plan_id
--   réputation  : rating, total_reviews
--   SCG         : scg_score, scg_badge, scg_bancable, scg_calculated_at, scg_criteria
--   système     : created_at, digest_last_sent_at
-- Rôle admin : table admin_roles (RLS : lecture de sa propre ligne seulement, aucune écriture membre).
-- KYC : verification_requests — un membre ne peut créer qu'une demande « pending ».
--
-- Remplace : trigger UPDATE trg_protect_profile_privileged (prod, fonction protect_profile_privileged_columns conservée) et trigger INSERT
-- trg_protect_profile_scg_insert (084). Fonctionne que 084 soit appliquée ou non.

BEGIN;

CREATE OR REPLACE FUNCTION public.profile_request_is_member()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $fn$
  -- Vrai seulement pour une requête PostgREST faite avec une session membre ou anonyme.
  -- Sans JWT (Supabase Auth / handle_new_user, cron, migrations) → false, jamais NULL.
  SELECT coalesce(
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
    ) IN ('anon', 'authenticated'),
    false
  )
$fn$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.profile_request_is_member() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.user_type               := NULL;
    NEW.sub_type                := NULL;
    NEW.coop_id                 := NULL;
    NEW.is_verified             := false;
    NEW.rccm_verified           := false;
    NEW.phone                   := NULL;
    NEW.phone_verified          := false;
    NEW.phone_linked_at         := NULL;
    NEW.email_linked_at         := NULL;
    NEW.is_suspended            := false;
    NEW.suspended_reason        := NULL;
    NEW.suspended_at            := NULL;
    NEW.suspended_by            := NULL;
    NEW.subscription_tier       := 'free';
    NEW.subscription_expires_at := NULL;
    NEW.pricing_plan_id         := NULL;
    NEW.rating                  := 0;
    NEW.total_reviews           := 0;
    NEW.scg_score               := 0;
    NEW.scg_badge               := 'debut';
    NEW.scg_bancable            := false;
    NEW.scg_calculated_at       := NULL;
    NEW.scg_criteria            := '{"kyc": 0, "network": 0, "quality": 0, "reviews": 0, "activity": 0, "transactions": 0}'::jsonb;
    NEW.created_at              := now();
    NEW.digest_last_sent_at     := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE
  NEW.id                      := OLD.id;
  NEW.user_type               := OLD.user_type;
  NEW.sub_type                := OLD.sub_type;
  NEW.coop_id                 := OLD.coop_id;
  NEW.is_verified             := OLD.is_verified;
  NEW.rccm_verified           := OLD.rccm_verified;
  NEW.phone                   := OLD.phone;
  NEW.phone_verified          := OLD.phone_verified;
  NEW.phone_linked_at         := OLD.phone_linked_at;
  NEW.email_linked_at         := OLD.email_linked_at;
  NEW.is_suspended            := OLD.is_suspended;
  NEW.suspended_reason        := OLD.suspended_reason;
  NEW.suspended_at            := OLD.suspended_at;
  NEW.suspended_by            := OLD.suspended_by;
  NEW.subscription_tier       := OLD.subscription_tier;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.pricing_plan_id         := OLD.pricing_plan_id;
  NEW.rating                  := OLD.rating;
  NEW.total_reviews           := OLD.total_reviews;
  NEW.scg_score               := OLD.scg_score;
  NEW.scg_badge               := OLD.scg_badge;
  NEW.scg_bancable            := OLD.scg_bancable;
  NEW.scg_calculated_at       := OLD.scg_calculated_at;
  NEW.scg_criteria            := OLD.scg_criteria;
  NEW.created_at              := OLD.created_at;
  NEW.digest_last_sent_at     := OLD.digest_last_sent_at;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.protect_profile_privileged_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_request_is_member() FROM PUBLIC, anon, authenticated;

-- Un seul trigger, INSERT et UPDATE (remplace les deux anciens). Nom en « trg_0_ » pour
-- s'exécuter AVANT trg_profile_completion (ordre alphabétique) : le % de complétion
-- est alors calculé sur les valeurs protégées.
DROP TRIGGER IF EXISTS trg_protect_profile_privileged ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_profile_scg_insert ON public.profiles;
DROP TRIGGER IF EXISTS trg_0_protect_profile_privileged ON public.profiles;
CREATE TRIGGER trg_0_protect_profile_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- Droits inutiles pour un membre sur profiles (non exposés par PostgREST, mais à retirer).
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM anon, authenticated, PUBLIC;

-- KYC : une demande créée par un membre est toujours « pending », sans relecteur.
CREATE OR REPLACE FUNCTION public.protect_verification_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF public.profile_request_is_member() THEN
    NEW.status      := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.notes       := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.protect_verification_request_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_protect_verification_request_insert ON public.verification_requests;
CREATE TRIGGER trg_protect_verification_request_insert
  BEFORE INSERT ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_verification_request_insert();

COMMIT;

-- Post-contrôles (lecture seule) :
-- SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.verification_requests'::regclass AND NOT tgisinternal;
