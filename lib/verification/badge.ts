/**
 * GWA — Badge « vérifié / certifié ».
 *
 * Règle métier (point 8) : le badge ne doit apparaître QUE si le compte est
 * réellement vérifié, c.-à-d. `is_verified = true` ET une demande KYC approuvée.
 *
 * `is_verified` reste la source de vérité côté UI (le trigger serveur + la
 * migration 031 garantissent qu'il n'est vrai qu'après approbation KYC).
 * Ce helper ajoute une seconde barrière défensive : si l'appelant connaît le
 * statut KYC, on exige explicitement `approved`.
 */

export type KycStatus = "pending" | "approved" | "rejected" | null | undefined

export interface VerifiableProfile {
  is_verified?: boolean | null
  /** Statut de la demande KYC la plus récente, si connu. */
  kyc_status?: KycStatus
}

/**
 * Retourne true si le badge « vérifié » doit être affiché.
 * - `is_verified` doit être strictement vrai.
 * - Si `kyc_status` est fourni, il doit valoir "approved".
 *   (Si non fourni, on fait confiance à `is_verified` — protégé côté serveur.)
 */
export function shouldShowVerifiedBadge(profile: VerifiableProfile | null | undefined): boolean {
  if (!profile) return false
  if (profile.is_verified !== true) return false
  if (profile.kyc_status !== undefined && profile.kyc_status !== null) {
    return profile.kyc_status === "approved"
  }
  return true
}

/**
 * Afficher le CTA « vérifier mon identité » seulement si pas encore fait
 * (ni badge, ni demande pending/approved).
 */
export function shouldPromptIdentityVerification(opts: {
  is_verified?: boolean | null
  kyc_status?: KycStatus
}): boolean {
  if (opts.is_verified === true) return false
  if (opts.kyc_status === "pending" || opts.kyc_status === "approved") return false
  return true
}
