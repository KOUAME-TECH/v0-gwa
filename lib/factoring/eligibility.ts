/**
 * GWA — Éligibilité à l'affacturage (préfinancement).
 *
 * Vision lean (point 4/11) : l'affacturage n'est PAS un rôle d'inscription séparé.
 * Un producteur ou une coopérative y accède si son Score de Confiance GWA (SCG)
 * le rend « bancable ». On centralise ici la règle pour /affacturage ET pour le
 * bloc affacturage des dashboards.
 */

export const FACTORING_MIN_SCORE = 500

export interface FactoringScgInput {
  scg_bancable?: boolean | null
  scg_score?: number | null
}

/** Rôles autorisés à demander de l'affacturage (vendeurs uniquement). */
export const FACTORING_ELIGIBLE_ROLES = ["producteur", "cooperative"] as const

export function roleCanRequestFactoring(userType: string | null | undefined): boolean {
  if (!userType) return false
  return (FACTORING_ELIGIBLE_ROLES as readonly string[]).includes(userType)
}

/**
 * Éligibilité SCG : bancable OU score >= seuil minimum.
 */
export function isFactoringEligible(input: FactoringScgInput | null | undefined): boolean {
  if (!input) return false
  if (input.scg_bancable === true) return true
  return typeof input.scg_score === "number" && input.scg_score >= FACTORING_MIN_SCORE
}
