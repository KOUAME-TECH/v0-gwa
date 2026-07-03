// GWA Platform — Validation et formatage téléphone CI
// Opérateurs CI : Orange (07/08), MTN (05/25), Moov (01/41), Wave (03), Telecel (27)

/**
 * Valide un numéro de téléphone Côte d'Ivoire.
 * Accepte : 0712345678 | +2250712345678 | 00225 07 12 34 56 78
 * Préfixes valides CI : 01, 03, 05, 07, 08, 09, 25, 27, 41, 47, 49, 57, 67, 77
 */
export function validateCIPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\.]/g, '').replace(/^(\+225|00225)/, '')
  // 10 chiffres, commençant par les préfixes CI valides
  return /^(01|03|05|07|08|09|25|27|41|47|49|57|67|77)\d{8}$/.test(cleaned)
}

/**
 * Normalise un numéro CI au format international E.164 (+225XXXXXXXXXX)
 * @throws Error si le numéro est invalide
 */
export function normalizeCIPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\.]/g, '').replace(/^(\+225|00225)/, '')
  if (!validateCIPhone(cleaned)) {
    throw new Error(
      `Numéro invalide. Format requis : 07 XX XX XX XX (préfixe opérateur CI)`
    )
  }
  return `+225${cleaned}`
}

/**
 * Formate un numéro pour l'affichage : +225 07 12 34 56 78
 */
export function formatCIPhone(phone: string): string {
  try {
    const normalized = normalizeCIPhone(phone)
    const digits = normalized.replace('+225', '')
    return `+225 ${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,6)} ${digits.slice(6,8)} ${digits.slice(8,10)}`
  } catch {
    return phone
  }
}

/**
 * Détecte l'opérateur à partir du préfixe CI
 */
export function detectCIOperator(phone: string): 'orange' | 'mtn' | 'moov' | 'wave' | 'telecel' | 'unknown' {
  const cleaned = phone.replace(/[\s\-\.]/g, '').replace(/^(\+225|00225)/, '')
  const prefix = cleaned.slice(0, 2)
  const prefixMap: Record<string, 'orange' | 'mtn' | 'moov' | 'wave' | 'telecel'> = {
    '07': 'orange', '08': 'orange', '09': 'orange', '47': 'orange', '57': 'orange',
    '05': 'mtn',    '25': 'mtn',    '45': 'mtn',
    '01': 'moov',   '41': 'moov',
    '03': 'wave',
    '27': 'telecel', '77': 'telecel',
  }
  return prefixMap[prefix] || 'unknown'
}

/**
 * Formate un numéro pour l'affichage court (sans indicatif)
 */
export function shortCIPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\.]/g, '').replace(/^(\+225|00225)/, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0,2)} ${cleaned.slice(2,4)} ${cleaned.slice(4,6)} ${cleaned.slice(6,8)} ${cleaned.slice(8,10)}`
  }
  return phone
}
