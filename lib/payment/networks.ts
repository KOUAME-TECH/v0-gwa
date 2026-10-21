/**
 * Normalisation générique des réseaux Mobile Money CI.
 */

export type MobileMoneyNetwork =
  | "orange_ci"
  | "mtn_ci"
  | "moov_ci"
  | "wave_ci"
  | "mtn"
  | "moov"

/** Map UI payment_method → réseau Mobile Money (défaut marché GWA). */
export function mapPaymentMethodToNetwork(
  method: string | null | undefined,
): MobileMoneyNetwork {
  const m = (method || "").toLowerCase().trim()
  if (m.includes("orange")) return "orange_ci"
  if (m.includes("wave")) return "wave_ci"
  if (m.includes("moov")) return "moov_ci"
  if (m.includes("mtn") || m.includes("momo")) return "mtn_ci"
  if (m === "mobile_money" || m === "geniuspay" || m === "feexpay" || !m) return "orange_ci"
  return "orange_ci"
}

/**
 * Normalise un numéro vers format international sans +.
 * CI : 225XXXXXXXXXX
 */
