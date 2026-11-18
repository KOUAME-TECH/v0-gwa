/**
 * Patch commun de libération du séquestre (route /release, litige « release_seller », confirm-delivery).
 * - status = 'delivered' : 'livre' est refusé par le CHECK orders_order_status_check en prod.
 * - payout_status NULL → 'pending_ops' : sinon la commande libérée n'entre jamais dans la file
 *   de versement (065 en liste blanche : pending_ops | failed | skipped_no_provider).
 *   Une valeur existante (pending_ops, failed, cancelled…) n'est jamais écrasée.
 */
export type ReleasableOrder = { payout_status?: string | null }

export function buildEscrowReleasePatch(order: ReleasableOrder, nowIso: string) {
  return {
    escrow_status: "released" as const,
    status: "delivered" as const,
    updated_at: nowIso,
    payout_status: order.payout_status ?? "pending_ops",
  }
}
