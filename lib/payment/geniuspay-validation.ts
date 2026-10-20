export type GeniusPayPaymentDetails = {
  reference: string
  amount: number
  currency: string
  metadata: Record<string, unknown>
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
