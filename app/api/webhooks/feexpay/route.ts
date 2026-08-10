import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isFeexPayFailedStatus,
  isFeexPayPaidStatus,
  verifyFeexPayTransaction,
} from "@/lib/feexpay/client"

/**
 * POST /api/webhooks/feexpay
 * Webhook paiements — HMAC obligatoire ; MAJ via service role.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.FEEXPAY_WEBHOOK_SECRET
    if (!secret) {
      console.error("[webhooks/feexpay] FEEXPAY_WEBHOOK_SECRET manquant")
      return NextResponse.json(
        { error: "Webhook non configuré" },
        { status: 503 },
      )
    }

    const raw = await request.text()
    const sig =
      request.headers.get("x-feexpay-signature") ||
      request.headers.get("x-signature") ||
      ""

    if (!sig) {
      return NextResponse.json({ error: "Signature manquante" }, { status: 401 })
    }

    const expected = createHmac("sha256", secret).update(raw).digest("hex")
    const provided = sig.replace(/^sha256=/i, "").trim()
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(provided, "utf8")
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 })
    }

    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
    }

    const ref = String(
      payload.reference || payload.feexpay_ref || payload.ref || "",
    )
    const status = String(payload.status || payload.payment_status || "")

    // callback_info peut être string JSON ou objet
    let callbackOrderId: string | null = null
    const cb = payload.callback_info ?? payload.callbackInfo
    if (typeof cb === "string" && cb.trim()) {
      try {
        const parsed = JSON.parse(cb) as { order_id?: string }
        if (parsed?.order_id) callbackOrderId = String(parsed.order_id)
      } catch {
        /* ignore */
      }
    } else if (cb && typeof cb === "object" && "order_id" in (cb as object)) {
      callbackOrderId = String((cb as { order_id: string }).order_id)
    }
    if (!callbackOrderId && payload.order_id) {
      callbackOrderId = String(payload.order_id)
    }

    if (!ref && !callbackOrderId) {
      return NextResponse.json(
        { error: "reference ou order_id manquant" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    let order: {
      id: string
      seller_id: string
      order_number: string
      total_amount: number
      payment_status: string
      feexpay_ref: string | null
    } | null = null

    if (ref) {
      const { data } = await admin
        .from("orders")
        .select(
          "id, seller_id, order_number, total_amount, payment_status, feexpay_ref",
        )
        .eq("feexpay_ref", ref)
        .maybeSingle()
      order = data
    }

    if (!order && callbackOrderId) {
      const { data } = await admin
        .from("orders")
        .select(
          "id, seller_id, order_number, total_amount, payment_status, feexpay_ref",
        )
        .eq("id", callbackOrderId)
        .maybeSingle()
      order = data
    }

    if (!order) {
      return NextResponse.json({ received: true, matched: false })
    }

    // Re-vérification optionnelle auprès de FeexPay (anti-spoof payload)
    let effectiveStatus = status
    if (ref && (isFeexPayPaidStatus(status) || !status)) {
      const verified = await verifyFeexPayTransaction(ref)
      if (verified.ok && verified.status) {
        effectiveStatus = verified.status
      }
    }

    const paid = isFeexPayPaidStatus(effectiveStatus)
    const failed = isFeexPayFailedStatus(effectiveStatus)

    if (paid) {
      if (order.payment_status === "paid") {
        return NextResponse.json({
          received: true,
          matched: true,
          paid: true,
          idempotent: true,
        })
      }

      const paidAmount = Number(
        payload.amount ?? payload.paid_amount ?? payload.montant ?? NaN,
      )
      const expectedAmt = Number(order.total_amount)
      if (
        Number.isFinite(paidAmount) &&
        Number.isFinite(expectedAmt) &&
        paidAmount + 1e-6 < expectedAmt
      ) {
        console.error(
          `[webhooks/feexpay] montant insuffisant ref=${ref} paid=${paidAmount} expected=${expectedAmt}`,
        )
        return NextResponse.json(
          { error: "Montant insuffisant", received: true, matched: true },
          { status: 422 },
        )
      }

      const now = new Date().toISOString()
      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          escrow_status: "held",
          status: "confirmed",
          feexpay_ref: ref || order.feexpay_ref,
          updated_at: now,
        })
        .eq("id", order.id)

      await admin
        .from("escrow_transactions")
        .update({
          status: "held",
          feexpay_ref: ref || order.feexpay_ref,
          paid_at: now,
        })
        .eq("order_id", order.id)

      await admin.from("order_audit_log").insert({
        order_id: order.id,
        performed_by: null,
        action: "feexpay_webhook_paid",
        new_value: "held",
        notes: `Webhook FeexPay ${ref || callbackOrderId}`,
      })

      return NextResponse.json({
        received: true,
        matched: true,
        paid: true,
      })
    }

    if (failed && order.payment_status !== "paid") {
      await admin
        .from("orders")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      await admin.from("order_audit_log").insert({
        order_id: order.id,
        performed_by: null,
        action: "feexpay_webhook_failed",
        new_value: "failed",
        notes: `Webhook FeexPay status=${effectiveStatus} ref=${ref}`,
      })

      return NextResponse.json({
        received: true,
        matched: true,
        paid: false,
        failed: true,
      })
    }

    return NextResponse.json({
      received: true,
      matched: true,
      paid: false,
      status: effectiveStatus,
    })
  } catch (err) {
    console.error("[webhooks/feexpay]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
