import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const { resolvePlatformSecret } = await import("@/lib/ops/platform-secrets")
  const secret = await resolvePlatformSecret("GENIUSPAY_WEBHOOK_SECRET")
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 })
  const raw = await request.text()
  const signature = request.headers.get("x-webhook-signature") || ""
  const timestamp = request.headers.get("x-webhook-timestamp") || ""
  if (!signature || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return NextResponse.json({ error: "Webhook invalide" }, { status: 401 })
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature.replace(/^sha256=/i, "").trim())
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Signature invalide" }, { status: 401 })
  const payload = JSON.parse(raw) as Record<string, any>
  const reference = String(payload.reference || payload.data?.reference || "")
  const status = String(payload.status || payload.data?.status || "").toLowerCase()
  const amount = Number(payload.amount ?? payload.data?.amount)
  if (!reference) return NextResponse.json({ error: "reference manquante" }, { status: 400 })
  const admin = createAdminClient()
  const { data: order } = await admin.from("orders").select("id,total_amount,payment_status").eq("feexpay_ref", reference).maybeSingle()
  if (!order) return NextResponse.json({ received: true, matched: false })
  if (["completed", "success", "successful", "paid"].includes(status)) {
    if (Number.isFinite(amount) && amount !== Number(order.total_amount)) return NextResponse.json({ error: "Montant invalide" }, { status: 422 })
    if (order.payment_status !== "paid") {
      await admin.from("orders").update({ payment_status: "paid", escrow_status: "held", status: "confirmed", updated_at: new Date().toISOString() }).eq("id", order.id)
      await admin.from("escrow_transactions").update({ status: "held", paid_at: new Date().toISOString() }).eq("order_id", order.id)
      await admin.from("order_audit_log").insert({ order_id: order.id, performed_by: null, action: "geniuspay_webhook_paid", new_value: "held", notes: `reference=${reference}` })
    }
  }
  return NextResponse.json({ received: true, matched: true })
}
