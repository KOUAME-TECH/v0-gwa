-- 031_fix_verified_badge.sql
-- GWA — Correction badge « certifié / vérifié »
-- Contexte : le badge (BadgeCheck) est rendu côté UI dès que profiles.is_verified = true.
-- Des comptes de démo/seed avaient is_verified = true SANS aucune demande KYC approuvée,
-- ce qui affichait le badge à tort. On réaligne la donnée sur la source de vérité :
-- une demande de vérification (verification_requests) au statut 'approved'.
--
-- La valeur par défaut de is_verified est déjà false (voir schéma), et seule la route
-- admin /api/admin/verifications/[id] passe is_verified à true après approbation KYC.

-- NB : le trigger trg_protect_profile_privileged (SECURITY DEFINER) empêche toute
-- modification de is_verified hors admin/service_role. On le désactive le temps de la
-- correction de données puis on le réactive (il reste la protection en production).

-- 1) Profils : retirer is_verified quand aucune demande KYC approuvée n'existe.
ALTER TABLE public.profiles DISABLE TRIGGER trg_protect_profile_privileged;

UPDATE public.profiles p
SET is_verified = false
WHERE p.is_verified = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.verification_requests vr
    WHERE vr.user_id = p.id
      AND vr.status = 'approved'
  );

ALTER TABLE public.profiles ENABLE TRIGGER trg_protect_profile_privileged;

-- 2) Coopératives : même logique (badge « Certifiée »).
--    Ne s'applique que si la table cooperatives possède la colonne is_verified.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cooperatives'
      AND column_name = 'is_verified'
  ) THEN
    UPDATE public.cooperatives c
    SET is_verified = false
    WHERE c.is_verified = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.verification_requests vr
        WHERE vr.cooperative_id = c.id
          AND vr.status = 'approved'
      );
  END IF;
END $$;
