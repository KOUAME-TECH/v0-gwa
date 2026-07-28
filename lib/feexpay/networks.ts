/**
 * Mapping réseaux FeexPay (sans I/O) — utilisable client + tests.
 */

export type FeexPayNetwork =
  | "orange_ci"
  | "mtn_ci"
  | "moov_ci"
  | "wave_ci"
  | "mtn"
  | "moov"

/** Map UI payment_method → réseau FeexPay CI (défaut marché GWA). */
export function mapPaymentMethodToNetwork(
  method: string | null | undefined,
): FeexPayNetwork {
  const m = (method || "").toLowerCase().trim()
  if (m.includes("orange")) return "orange_ci"
  if (m.includes("wave")) return "wave_ci"
  if (m.includes("moov")) return "moov_ci"
  if (m.includes("mtn") || m.includes("momo")) return "mtn_ci"
  if (m === "mobile_money" || m === "feexpay" || !m) return "orange_ci"
  return "orange_ci"
}

/**
 * Normalise un numéro vers format international sans +.
 * CI : 225XXXXXXXXXX
 */
export function normalizeFeexPayPhone(
  raw: string | null | undefined,
  defaultCountry: "ci" | "bj" = "ci",
): string | null {
  if (!raw) return null
  let digits = String(raw).replace(/\D/g, "")
  if (!digits) return null
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (defaultCountry === "ci") {
    if (digits.length === 10 && digits.startsWith("0")) {
      digits = `225${digits.slice(1)}`
    } else if (digits.length === 8 || digits.length === 9) {
      digits = `225${digits}`
    } else if (digits.length === 10 && !digits.startsWith("225")) {
      digits = `225${digits}`
    }
  }
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}
