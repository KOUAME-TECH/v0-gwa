/** Cycle de vie affiché et filtré. Source unique pour l'admin et les API. */

export const ORDER_LIFECYCLE = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
] as const

export type OrderLifecycle = (typeof ORDER_LIFECYCLE)[number]

export const ORDER_LIFECYCLE_LABELS: Record<OrderLifecycle, string> = {
  pending: "En attente de paiement",
  paid: "Payée, argent protégé",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  completed: "Réception confirmée",
  cancelled: "Annulée",
  disputed: "Litige",
}

export function isOrderLifecycle(value: string): value is OrderLifecycle {
  return (ORDER_LIFECYCLE as readonly string[]).includes(value)
}

export function deriveLifecycle(input: {
  status?: string | null
  payment_status?: string | null
  escrow_status?: string | null
  confirmed_by_buyer_at?: string | null
  lifecycle_status?: string | null
}): OrderLifecycle {
  if (input.lifecycle_status && isOrderLifecycle(input.lifecycle_status)) {
    return input.lifecycle_status
  }
  const status = input.status || "pending"
  if (status === "cancelled") return "cancelled"
  if (status === "disputed" || input.escrow_status === "frozen") return "disputed"
  if (
    input.confirmed_by_buyer_at ||
    status === "completed" ||
    (status === "delivered" && input.escrow_status === "released")
  ) {
    return "completed"
  }
  if (status === "delivered") return "delivered"
  if (status === "shipped" || status === "shipping") return "shipped"
  if (status === "processing" || status === "preparing") return "processing"
  if (input.payment_status === "paid" || input.escrow_status === "held" || status === "paid") {
    return "paid"
  }
  return "pending"
}
