/** Statuts commande / escrow — source unique UI + APIs. */

export const ORDER_FLOW = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
] as const

export type OrderFlowStatus = (typeof ORDER_FLOW)[number]

export type EscrowStatus = "pending" | "held" | "released" | "frozen" | null | undefined

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
  disputed: "Litige",
  // legacy UI aliases
  preparing: "En préparation",
  shipping: "En livraison",
}

export const ESCROW_STEP_LABELS = [
  { id: "payer", label: "Payer" },
  { id: "sequestre", label: "Séquestre" },
  { id: "livre", label: "Livré" },
  { id: "confirme", label: "Confirmé" },
  { id: "libere", label: "Libéré" },
] as const

/** Index 0–4 du stepper escrow selon paiement + escrow + statut commande. */
export function resolveEscrowStep(input: {
  payment_status?: string | null
  escrow_status?: EscrowStatus
  status?: string | null
}): number {
  const pay = input.payment_status || "pending"
  const esc = input.escrow_status || "pending"
  const st = normalizeOrderStatus(input.status || "pending")

  if (esc === "released" || st === "delivered") return 4
  if (esc === "frozen" || st === "disputed") return 2
  if (st === "shipped") return 2
  if (pay === "paid" && (esc === "held" || esc === "pending")) {
    if (st === "confirmed" || st === "processing") return 1
    return 1
  }
  if (pay === "processing") return 0
  if (pay === "paid") return 1
  return 0
}

export function normalizeOrderStatus(status: string): string {
  if (status === "preparing") return "processing"
  if (status === "shipping") return "shipped"
  return status
}

export function orderFlowIndex(status: string): number {
  const n = normalizeOrderStatus(status)
  if (n === "cancelled" || n === "disputed") return -1
  const i = ORDER_FLOW.indexOf(n as OrderFlowStatus)
  return i >= 0 ? i : 0
}

export function escrowStatusMessage(step: number, escrow?: EscrowStatus): string {
  if (escrow === "frozen") {
    return "Fonds gelés — litige en cours. L’équipe GWA examine le dossier."
  }
  switch (step) {
    case 0:
      return "Paiement en cours. L’argent n’est pas encore en séquestre."
    case 1:
      return "Fonds en séquestre Feexpay — le vendeur ne peut pas encore retirer."
    case 2:
      return "Commande en livraison — confirme la réception pour libérer l’argent."
    case 3:
      return "Réception confirmée — libération des fonds en cours."
    case 4:
      return "Fonds libérés au vendeur. Transaction terminée."
    default:
      return ""
  }
}
