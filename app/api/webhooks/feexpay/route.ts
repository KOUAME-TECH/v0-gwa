import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveFeexPayWebhookSecret } from "@/lib/feexpay/client"

/**
 * POST /api/webhooks/feexpay
 * Webhook paiements — HMAC obligatoire ; MAJ via service role.
 */
export async function POST(request: Request) {
  try {
    const secret = await resolveFeexPayWebhookSecret()
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
    if (!ref) {
      return NextResponse.json({ error: "reference manquante" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: order } = await admin
      .from("orders")
      .select("id, seller_id, order_number, total_amount, payment_status")
      .eq("feexpay_ref", ref)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ received: true, matched: false })
    }

    const paid =
      status === "success" ||
      status === "paid" ||
      status === "successful" ||
      status === "completed"

    if (paid) {
      if (order.payment_status === "paid") {
        return NextResponse.json({ received: true, matched: true, paid: true, idempotent: true })
      }

      const paidAmount = Number(
        payload.amount ?? payload.paid_amount ?? payload.montant ?? NaN,
      )
      const expectedAmount = Number(order.total_amount)
      if (
        Number.isFinite(paidAmount) &&
        Number.isFinite(expectedAmount) &&
        paidAmount + 1e-6 < expectedAmount
      ) {
        console.error(
          `[webhooks/feexpay] montant insuffisant ref=${ref} paid=${paidAmount} expected=${expectedAmount}`,
        )
        return NextResponse.json(
          { error: "Montant insuffisant", received: true, matched: true },
          { status: 422 },
        )
      }

      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          escrow_status: "held",
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      await admin
        .from("escrow_transactions")
        .update({
          status: "held",
          feexpay_ref: ref,
          paid_at: new Date().toISOString(),
        })
        .eq("order_id", order.id)

      await admin.from("order_audit_log").insert({
        order_id: order.id,
        performed_by: null,
        action: "feexpay_webhook_paid",
        new_value: "held",
        notes: `Webhook Feexpay ${ref}`,
      })
    }

    return NextResponse.json({ received: true, matched: true, paid })
  } catch (err) {
    console.error("[webhooks/feexpay]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
