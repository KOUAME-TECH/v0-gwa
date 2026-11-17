import { createAdminClient } from "@/lib/supabase/admin"
import { payoutLedgerLines, recordLedgerLines } from "@/lib/features/payments/ledger"

export type EscrowReleaseResult =
  | { ok: true; alreadyReleased?: boolean }
  | { ok: false; status: number; error: string; code?: string }

type OrderRow = {
  id: string
  seller_id: string
  buyer_id: string
  payment_status: string | null
  escrow_status: string | null
  currency?: string | null
  total_amount?: number | string | null
  vendeur_recoit_fcfa?: number | string | null
  commission_fcfa?: number | string | null
  seller_commission?: number | string | null
  buyer_service_fee?: number | string | null
  delivered_at?: string | null
}

/**
 * Libère l'escrow d'une commande. Client service_role uniquement.
 * Exige payment_status = 'paid' ET escrow_status = 'held'. Toute erreur d'écriture est remontée (jamais avalée).
 */
export async function releaseOrderEscrow(
  order: OrderRow,
  opts: { actorId: string | null; trigger: "buyer" | "admin" | "auto_72h"; confirmedByBuyer?: boolean },
): Promise<EscrowReleaseResult> {
  if (order.escrow_status === "released") return { ok: true, alreadyReleased: true }
  if (order.payment_status !== "paid" || order.escrow_status !== "held") {
    return {
      ok: false,
      status: 409,
      code: "ESCROW_NOT_HELD",
      error: "Impossible de libérer : paiement non confirmé ou fonds non en séquestre",
    }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: "delivered",
    escrow_status: "released",
    delivered_at: order.delivered_at || now,
    updated_at: now,
  }
  if (opts.confirmedByBuyer) patch.confirmed_by_buyer_at = now

  // Update conditionnel : une seule libération gagnante (anti double-clic / course).
  const { data: updated, error: orderErr } = await admin
    .from("orders")
    .update(patch)
    .eq("id", order.id)
    .eq("payment_status", "paid")
    .eq("escrow_status", "held")
    .select("id")
    .maybeSingle()
  if (orderErr) {
    console.error("[escrow-release] order update", orderErr.message)
    return { ok: false, status: 500, error: "La libération n’a pas pu être enregistrée." }
  }
  if (!updated) return { ok: true, alreadyReleased: true }

  const { error: escrowErr } = await admin
    .from("escrow_transactions")
    .update({ status: "released", released_at: now })
    .eq("order_id", order.id)
    .in("status", ["held", "pending"])
  if (escrowErr) {
    console.error("[escrow-release] escrow update", escrowErr.message)
    return { ok: false, status: 500, error: "La libération n’a pas pu être enregistrée." }
  }

  const sellerNet = Math.round(Number(order.vendeur_recoit_fcfa) || 0)
  const ledger = await recordLedgerLines(
    admin as never,
    payoutLedgerLines({
      transactionId: order.id,
      sellerNet,
      commission: Math.round(Number(order.commission_fcfa ?? order.seller_commission) || 0),
      buyerFee: Math.round(Number(order.buyer_service_fee) || 0),
      currency: order.currency || "XOF",
    }),
  )
  if (!ledger.ok) {
    console.error("[escrow-release] ledger", ledger.error)
    return { ok: false, status: 500, error: ledger.error }
  }

  const { error: auditErr } = await admin.from("order_audit_log").insert({
    order_id: order.id,
    performed_by: opts.actorId,
    action: "escrow_released",
    new_value: "released",
    notes: `trigger=${opts.trigger}`,
  })
  if (auditErr) console.error("[escrow-release] audit", auditErr.message)

  return { ok: true }
}
