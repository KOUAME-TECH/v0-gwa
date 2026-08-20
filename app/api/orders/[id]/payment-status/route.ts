import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth/require-admin"
import {
  getFeexPayCredentials,
  isFeexPayFailedStatus,
  isFeexPayPaidStatus,
  verifyFeexPayTransaction,
} from "@/lib/feexpay/client"

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/orders/[id]/payment-status
 * Polling confirmation USSD / retour FeexPay.
 */
export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user
    const supabase = gate.supabase

    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, buyer_id, order_number, payment_status, escrow_status, status, feexpay_ref, total_amount",
      )
      .eq("id", id)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    }
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Si encore processing + ref FeexPay → re-vérifier côté provider
    if (
      order.payment_status === "processing" &&
      order.feexpay_ref &&
      !String(order.feexpay_ref).startsWith("SIM-") &&
      getFeexPayCredentials()
    ) {
      const verified = await verifyFeexPayTransaction(String(order.feexpay_ref))
      if (verified.ok && isFeexPayPaidStatus(verified.status)) {
        const raw = verified.raw || {}
        const paidAmount = Number(
          raw.amount ?? raw.paid_amount ?? raw.montant ?? NaN,
        )
        const expectedAmt = Number(order.total_amount)
        // Aligné webhook : montant obligatoire + >= attendu
        if (!Number.isFinite(paidAmount)) {
          console.error(
            `[api/orders/payment-status] amount_missing ref=${order.feexpay_ref}`,
          )
          return NextResponse.json({
            order_id: id,
            payment_status: "processing",
            escrow_status: order.escrow_status,
            status: order.status,
            feexpay_ref: order.feexpay_ref,
            verified: true,
            amount_missing: true,
          })
        }
        if (
          Number.isFinite(expectedAmt) &&
          paidAmount + 1e-6 < expectedAmt
        ) {
          console.error(
            `[api/orders/payment-status] amount_mismatch ref=${order.feexpay_ref} paid=${paidAmount} expected=${expectedAmt}`,
          )
          return NextResponse.json({
            order_id: id,
            payment_status: "processing",
            escrow_status: order.escrow_status,
            status: order.status,
            feexpay_ref: order.feexpay_ref,
            verified: true,
            amount_mismatch: true,
            paid_amount: paidAmount,
            expected_amount: expectedAmt,
          })
        }

        const admin = createAdminClient()
        const now = new Date().toISOString()
        await admin
          .from("orders")
          .update({
            payment_status: "paid",
            escrow_status: "held",
            status: "confirmed",
            updated_at: now,
          })
          .eq("id", id)
          .eq("payment_status", "processing")

        await admin
          .from("escrow_transactions")
          .update({
            status: "held",
            feexpay_ref: order.feexpay_ref,
            paid_at: now,
          })
          .eq("order_id", id)

        return NextResponse.json({
          order_id: id,
          payment_status: "paid",
          escrow_status: "held",
          status: "confirmed",
          feexpay_ref: order.feexpay_ref,
          verified: true,
        })
      }
      if (verified.ok && isFeexPayFailedStatus(verified.status)) {
        const admin = createAdminClient()
        await admin
          .from("orders")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("payment_status", "processing")

        return NextResponse.json({
          order_id: id,
          payment_status: "failed",
          escrow_status: order.escrow_status,
          status: order.status,
          feexpay_ref: order.feexpay_ref,
          verified: true,
        })
      }
    }

    return NextResponse.json({
      order_id: id,
      payment_status: order.payment_status,
      escrow_status: order.escrow_status,
      status: order.status,
      feexpay_ref: order.feexpay_ref,
      verified: false,
    })
  } catch (err) {
    console.error("[api/orders/payment-status]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
