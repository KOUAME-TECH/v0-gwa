/**
 * Solde Wallet vendeur — source unique UI + API withdraw.
 *
 * Modèle aligné CGU Art. 5 + 6 :
 * - Confirm / payout FeexPay réussi → payout_status=paid → EXCLU du solde (déjà sorti).
 * - Admin release ou crédit différé → escrow released + payout_status crédité wallet → INCLUS.
 * - Withdraw = seul chemin de sortie MM pour le solde comptable restant.
 */

export const WALLET_EXCLUDED_PAYOUT_STATUSES = new Set([
  "paid",
  "skipped_sim",
  "processing",
  "skipped_zero",
])

/** Commandes qui alimentent le solde retirable. */
export function orderCountsTowardWalletBalance(order: {
  payment_status?: string | null
  escrow_status?: string | null
  payout_status?: string | null
  status?: string | null
}): boolean {
  const pay = String(order.payment_status || "").toLowerCase()
  if (pay === "refunded") return false
  if (pay !== "paid") return false
  if (order.escrow_status !== "released") return false
  const ps = (order.payout_status || "").toLowerCase()
  // Déjà sorti via payout confirm / sim → exclus (anti double cash-out)
  if (ps && WALLET_EXCLUDED_PAYOUT_STATUSES.has(ps)) return false
  return true
}

export function orderNetToSellerFcfa(order: {
  vendeur_recoit_fcfa?: number | null
  total_amount?: number | null
  commission_fcfa?: number | null
  service_fee?: number | null
}): number {
  if (order.vendeur_recoit_fcfa != null) {
    return Math.max(0, Math.round(Number(order.vendeur_recoit_fcfa) || 0))
  }
  return Math.max(
    0,
    Math.round(Number(order.total_amount) || 0) -
      Math.round(Number(order.commission_fcfa) || 0) -
      Math.round(Number(order.service_fee) || 0),
  )
}

export function sumWalletAvailableFcfa(
  orders: Parameters<typeof orderCountsTowardWalletBalance>[0] &
    Parameters<typeof orderNetToSellerFcfa>[0][],
  priorWithdrawalsFcfa: number,
): { available: number; gross: number; withdrawn: number } {
  const gross = orders.reduce((sum, o) => {
    if (!orderCountsTowardWalletBalance(o)) return sum
    return sum + orderNetToSellerFcfa(o)
  }, 0)
  const withdrawn = Math.max(0, Math.round(priorWithdrawalsFcfa) || 0)
  return {
    gross,
    withdrawn,
    available: Math.max(0, gross - withdrawn),
  }
}
