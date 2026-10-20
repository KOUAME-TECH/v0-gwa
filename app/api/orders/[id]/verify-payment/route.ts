import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { getGeniusPayPayment, isGeniusPayPaymentForOrder } from "@/lib/payment/geniuspay"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("PAYMENT")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 })
    }

    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, total_amount, payment_status, payment_method, provider_reference")
      .eq("id", id)
      .maybeSingle()
    if (orderError) {
      if (
        orderError.code === "42703" ||
        /provider_reference.*column|column.*provider_reference/i.test(orderError.message)
      ) {
        return NextResponse.json(
          { error: "Migration 057 requise pour GeniusPay", code: "MIGRATION_REQUIRED" },
          { status: 503 },
        )
      }
      throw orderError
    }
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
    if (order.payment_status === "paid") {
      const admin = createAdminClient()
      const now = new Date().toISOString()
      const { error: escrowError } = await admin
        .from("escrow_transactions")
        .update({ status: "held", paid_at: now })
        .eq("order_id", id)
        .eq("tranche_numero", 1)
        .eq("status", "pending")
      if (escrowError) throw escrowError
      return NextResponse.json({ status: "paid" })
    }
    if (order.payment_method !== "geniuspay" || !order.provider_reference) {
      return NextResponse.json({ error: "Référence GeniusPay introuvable" }, { status: 409 })
    }

    const result = await getGeniusPayPayment(order.provider_reference)
    if (!result.ok || !result.data) {
      return NextResponse.json(
        { error: "Statut GeniusPay temporairement indisponible", code: result.error },
        { status: 502 },
      )
    }

    const payment = result.data
    if (
      !isGeniusPayPaymentForOrder(payment, {
        id: order.id,
        totalAmount: Math.round(Number(order.total_amount)),
        reference: order.provider_reference,
      })
    ) {
      console.error("[api/orders/verify-payment] GeniusPay payment/order mismatch", {
        orderId: id,
        reference: order.provider_reference,
      })
      return NextResponse.json({ error: "Données de paiement non concordantes" }, { status: 422 })
    }

    if (payment.status !== "completed") {
      return NextResponse.json({ status: "pending" })
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "paid",
        escrow_status: "held",
        status: "confirmed",
        updated_at: now,
      })
      .eq("id", id)
      .eq("payment_status", "processing")
      .eq("payment_method", "geniuspay")
      .eq("provider_reference", payment.reference)
      .select("id")
      .maybeSingle()
    if (updateError) throw updateError

    if (updated) {
      const { error: escrowError } = await admin
        .from("escrow_transactions")
        .update({ status: "held", paid_at: now })
        .eq("order_id", id)
        .eq("tranche_numero", 1)
        .eq("status", "pending")
      if (escrowError) throw escrowError

      await admin.from("order_audit_log").insert({
        order_id: id,
        performed_by: user.id,
        action: "geniuspay_payment_verified",
        new_value: "held",
        notes: `GeniusPay ${payment.reference}; ${payment.amount} XOF`,
      })
    }
    return NextResponse.json({ status: "paid" })
  } catch (err) {
    console.error("[api/orders/verify-payment]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
