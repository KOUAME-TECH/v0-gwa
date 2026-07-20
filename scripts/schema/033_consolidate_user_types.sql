-- 033_consolidate_user_types.sql
-- Nouvelle vision GWA (agriculture only) : on ne garde que 3 types d'utilisateur
--   producteur (vendeur agricole) · acheteur · cooperative
-- Les rôles hérités (artisan, transformateur, entreprise) sont migrés puis interdits.
-- Idempotent : ré-exécutable sans risque.

BEGIN;

-- 1) Migration des rôles obsolètes vers la nouvelle vision
UPDATE public.profiles
   SET user_type = 'producteur'
 WHERE user_type IN ('artisan', 'transformateur');

UPDATE public.profiles
   SET user_type = 'acheteur'
 WHERE user_type IN ('entreprise', 'business');

-- 2) Contrainte alignée sur la nouvelle vision
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('producteur', 'acheteur', 'cooperative'));

COMMIT;
