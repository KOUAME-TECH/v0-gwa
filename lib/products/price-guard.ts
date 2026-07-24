/**
 * Alerte prix anormal — comparaison simple vs médiane catégorie (soft warn).
 */

export type PriceCheckResult = {
  ok: boolean
  warning?: string
  median?: number
}

/** Médiane d’une liste de nombres. */
export function median(values: number[]): number | null {
  const xs = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (xs.length === 0) return null
  const mid = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2
}

/**
 * Flag si prix < 25% ou > 400% de la médiane (échantillon peers).
 */
export function checkPriceAnomaly(
  price: number,
  peerPrices: number[],
): PriceCheckResult {
  const m = median(peerPrices)
  if (m == null || m <= 0) return { ok: true }
  if (price < m * 0.25) {
    return {
      ok: false,
      warning: `Prix très bas vs médiane (~${Math.round(m)}). Vérifie l’unité ou une erreur de saisie.`,
      median: m,
    }
  }
  if (price > m * 4) {
    return {
      ok: false,
      warning: `Prix très élevé vs médiane (~${Math.round(m)}). Confirme avant de publier.`,
      median: m,
    }
  }
  return { ok: true, median: m }
}
