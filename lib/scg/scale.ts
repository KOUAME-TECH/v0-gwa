/**
 * Échelle unique du Score de Confiance GWA (SCG) : 0 à 1000 (directive de Yao, 25/11/2026).
 * Toute lecture, écriture ou affichage du score global passe par ces helpers.
 * Les 5 dimensions restent des sous-scores sur 100 (pondérées, puis × 10).
 * Contrainte SQL correspondante : scripts/schema/083_scg_max_1000.sql.
 */
export const SCG_MIN = 0
export const SCG_MAX = 1000

/** Seuil « bancable » (affacturage, badge). Même valeur que FACTORING_MIN_SCORE. */
export const SCG_BANCABLE_MIN = 500

/** Score entier borné à [0, 1000]. Valeur absente ou invalide → 0. */
export function clampScg(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return SCG_MIN
  return Math.max(SCG_MIN, Math.min(SCG_MAX, Math.round(value)))
}

/** Part du maximum, entre 0 et 1 (jauges, barres). */
export function scgRatio(value: number | null | undefined): number {
  return clampScg(value) / SCG_MAX
}

/** Libellé affiché partout : « 640 / 1000 ». */
export function formatScg(value: number | null | undefined): string {
  return `${clampScg(value)} / ${SCG_MAX}`
}
