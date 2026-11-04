export type PayNavigation =
  | { action: "redirect"; url: string }
  | { action: "simulated" }
  | { action: "ussd" }
  | { action: "error"; message: string }

const TECHNICAL = /geniuspay|checkout|provider|migration|webhook|\bapi\b/i

export function buyerSafePaymentError(raw: unknown): string {
  const fallback = "Le paiement n’a pas pu démarrer. Réessaie dans un instant."
  if (typeof raw !== "string") return fallback
  const msg = raw.trim()
  if (!msg || TECHNICAL.test(msg)) return fallback
  return msg
}

function collectUrls(value: unknown, out: string[], depth = 0) {
  if (!value || depth > 3) return
  if (typeof value !== "object") return
  const rec = value as Record<string, unknown>
  for (const key of ["payment_url", "checkout_url", "url", "checkoutUrl"]) {
    if (typeof rec[key] === "string") out.push(rec[key] as string)
  }
  if (rec.data) collectUrls(rec.data, out, depth + 1)
}

export function isGeniusPayCheckoutUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:") return false
    const host = url.hostname.toLowerCase()
    return (
      host === "geniuspay.ci" ||
      host === "pay.genius.ci" ||
      host === "www.geniuspay.ci" ||
      host === "checkout.geniuspay.ci" ||
      host.endsWith(".geniuspay.ci")
    )
  } catch {
    return false
  }
}

export function readPaymentRedirectUrl(payload: unknown): string | null {
  const urls: string[] = []
  collectUrls(payload, urls)
  return urls.find((url) => isGeniusPayCheckoutUrl(url)) ?? null
}

/**
 * Décide la navigation après POST /api/orders/:id/pay.
 * Une réponse sans URL GeniusPay ne doit jamais vider le panier
 * ni envoyer l'acheteur sur la confirmation.
 */
export function interpretPayResponse(status: number, payload: unknown): PayNavigation {
  const url = readPaymentRedirectUrl(payload)
  if (status >= 200 && status < 300 && url) return { action: "redirect", url }
  if (status >= 200 && status < 300 && payload && typeof payload === "object") {
    const statusField = (payload as { status?: unknown }).status
    if (statusField === "paid_simulated") return { action: "simulated" }
    if (statusField === "ussd_pending") return { action: "ussd" }
  }
  const error =
    payload && typeof payload === "object"
      ? (payload as { error?: unknown }).error
      : undefined
  return { action: "error", message: buyerSafePaymentError(error) }
}
