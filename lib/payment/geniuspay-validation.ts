export type GeniusPayPaymentDetails = {
  reference: string
  amount: number
  currency: string
  status: string
  metadata: Record<string, unknown>
}

export type GeniusPayPayment = GeniusPayPaymentDetails

export function parseGeniusPayPayment(
  data: Record<string, unknown>,
  options: { defaultCurrency?: string } = {},
): GeniusPayPayment | null {
  const reference = typeof data.reference === "string" ? data.reference.trim() : ""
  const amount = Number(data.amount)
  const currency =
    typeof data.currency === "string" ? data.currency : options.defaultCurrency || ""
  const status = typeof data.status === "string" ? data.status.toLowerCase() : ""
  const metadata =
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {}
  if (!reference || !Number.isFinite(amount) || !currency || !status) return null
  return { reference, amount, currency, status, metadata }
}

export function isGeniusPayPaymentForOrder(
  payment: GeniusPayPaymentDetails,
  order: { id: string; totalAmount: number; reference: string },
): boolean {
  return (
    payment.reference === order.reference &&
    payment.currency === "XOF" &&
    payment.amount === order.totalAmount &&
    String(payment.metadata.order_id ?? "") === order.id
  )
}
