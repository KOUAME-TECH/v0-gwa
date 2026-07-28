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
  pending: "En attente du vendeur",
  confirmed: "Acceptée",
  processing: "On prépare",
  shipped: "En route",
  delivered: "Bien reçue",
  cancelled: "Annulée",
  disputed: "Un souci",
  // legacy UI aliases
  preparing: "On prépare",
  shipping: "En route",
}

export const ESCROW_STEP_LABELS = [
  { id: "payer", label: "Payer" },
  { id: "sequestre", label: "Argent protégé" },
  { id: "livre", label: "En route" },
  { id: "confirme", label: "Reçu" },
  { id: "libere", label: "Vendeur payé" },
] as const

/** Raisons litige alignées CHECK DB (004_admin_system.sql). */
export const DISPUTE_REASONS = [
  { id: "product_not_received", label: "Produit non reçu" },
  { id: "product_damaged", label: "Produit abîmé" },
  { id: "wrong_product", label: "Mauvais produit" },
  { id: "quality_issue", label: "Problème de qualité" },
  { id: "other", label: "Autre" },
] as const

export type DisputeReasonId = (typeof DISPUTE_REASONS)[number]["id"]

const DISPUTE_REASON_SET = new Set<string>(DISPUTE_REASONS.map((r) => r.id))

export function normalizeDisputeReason(reason?: string | null): DisputeReasonId {
  if (reason && DISPUTE_REASON_SET.has(reason)) return reason as DisputeReasonId
  return "other"
}

export function mapLitigeDescriptionToReason(description: string): DisputeReasonId {
  if (/pas reçu|non reçu|pas livré|jamais arriv/i.test(description)) {
    return "product_not_received"
  }
  if (/abîmé|cassé|endommag|pourri|avari/i.test(description)) {
    return "product_damaged"
  }
  if (/mauvais produit|pas le bon|erreur produit|wrong/i.test(description)) {
    return "wrong_product"
  }
  if (/qualité|quantité|manquant|moisi|sale/i.test(description)) {
    return "quality_issue"
  }
  return "other"
}

/**
 * Index 0–4 du stepper escrow selon paiement + escrow + statut commande.
 * 0 Payer → 1 Séquestre → 2 Livré → 3 Confirmé → 4 Libéré
 */
export function resolveEscrowStep(input: {
  payment_status?: string | null
  escrow_status?: EscrowStatus
  status?: string | null
}): number {
  const pay = input.payment_status || "pending"
  const esc = input.escrow_status || "pending"
  const st = normalizeOrderStatus(input.status || "pending")

  if (esc === "released") return 4
  if (esc === "frozen" || st === "disputed") return 2

  // Livré côté commande mais fonds encore en séquestre → étape Confirmé
  if (st === "delivered" && esc === "held") return 3
  if (st === "delivered") return 4

  if (st === "shipped") return 2

  if (pay === "paid" && (esc === "held" || esc === "pending")) {
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
    return "Paiement gelé — litige en cours."
  }
  switch (step) {
    case 0:
      return "Paiement en attente."
    case 1:
      return "Argent protégé jusqu’à confirmation de réception."
    case 2:
      return "En livraison — confirme à réception."
    case 3:
      return "Réception confirmée — paiement vendeur en cours."
    case 4:
      return "Commande terminée."
    default:
      return ""
  }
}

export function humanPaymentLabel(method?: string | null, status?: string | null): string {
  const st = (status || "").toLowerCase()
  const statusLabel =
    st === "paid"
      ? "payé"
      : st === "pending"
        ? "en attente"
        : st === "failed"
          ? "échoué"
          : st || "en cours"
  const methodLabel =
    !method || method === "feexpay" || method === "FeexPay"
      ? "Paiement sécurisé"
      : method
  return `${methodLabel} (${statusLabel})`
}

/** Acheteur peut confirmer réception seulement si fonds réellement en séquestre. */
export function canBuyerConfirmReception(input: {
  isSeller: boolean
  payment_status?: string | null
  escrow_status?: EscrowStatus
  status?: string | null
}): boolean {
  if (input.isSeller) return false
  if (input.payment_status !== "paid") return false
  if (input.escrow_status !== "held") return false
  const st = normalizeOrderStatus(input.status || "pending")
  return ["shipped", "processing", "confirmed", "delivered"].includes(st)
}

export function canOpenLitige(input: {
  payment_status?: string | null
  escrow_status?: EscrowStatus
  status?: string | null
}): boolean {
  const st = normalizeOrderStatus(input.status || "pending")
  if (st === "disputed" || st === "cancelled" || st === "delivered") return false
  if (input.escrow_status === "frozen" || input.escrow_status === "released") return false
  return input.payment_status === "paid"
}
