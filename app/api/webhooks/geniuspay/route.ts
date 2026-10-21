import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getGeniusPayPayment,
  resolveGeniusPayCredentials,
  resolveGeniusPayWebhookSecret,
} from "@/lib/payment/geniuspay"
import { isGeniusPayPaymentForOrder } from "@/lib/payment/geniuspay-validation"
import {
  isGeniusPayWebhookEnvelopeConsistent,
  isGeniusPayWebhookTimestampFresh,
  verifyGeniusPayWebhookSignature,
} from "@/lib/payment/geniuspay-webhook-validation"

export const dynamic = "force-dynamic"

type WebhookPayload = {
  event?: unknown
  environment?: unknown
  reference?: unknown
  data?: { reference?: unknown } | null
}

function paymentReference(payload: WebhookPayload): string {
  const reference = payload.data?.reference ?? payload.reference
  return typeof reference === "string" ? reference.trim() : ""
}

function apiKeyEnvironment(apiKey: string): "sandbox" | "live" | null {
  if (apiKey.startsWith("pk_sandbox_")) return "sandbox"
  if (apiKey.startsWith("pk_live_")) return "live"
  return null
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Content-Type invalide" }, { status: 415 })
    }

    const contentLength = Number(request.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
      return NextResponse.json({ error: "Payload trop volumineux" }, { status: 413 })
    }
    const rawBody = new Uint8Array(await request.arrayBuffer())
    if (rawBody.byteLength > 64 * 1024) {
      return NextResponse.json({ error: "Payload trop volumineux" }, { status: 413 })
    }

    const timestamp = request.headers.get("x-webhook-timestamp") || ""
    if (!isGeniusPayWebhookTimestampFresh(timestamp)) {
      return NextResponse.json({ error: "Timestamp webhook expiré ou invalide" }, { status: 400 })
    }

    const signature = request.headers.get("x-webhook-signature") || ""
    const event = request.headers.get("x-webhook-event") || ""
    const webhookEnvironment = request.headers.get("x-webhook-environment") || ""
    if (webhookEnvironment !== "sandbox" && webhookEnvironment !== "live") {
      return NextResponse.json({ error: "Environnement webhook invalide" }, { status: 400 })
    }
    const credentials = await resolveGeniusPayCredentials(webhookEnvironment)
    if (!credentials || apiKeyEnvironment(credentials.apiKey) !== webhookEnvironment) {
      return NextResponse.json({ error: "Environnement GeniusPay non concordant" }, { status: 403 })
    }

    let payload: WebhookPayload
    try {
      const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody))
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Objet webhook invalide" }, { status: 400 })
      }
      payload = parsed as WebhookPayload
    } catch {
      return NextResponse.json({ error: "JSON webhook invalide" }, { status: 400 })
    }

    if (!event || !isGeniusPayWebhookEnvelopeConsistent(payload, event, webhookEnvironment)) {
      return NextResponse.json({ error: "Événement ou environnement webhook non concordant" }, { status: 400 })
    }
    const webhookSecret = await resolveGeniusPayWebhookSecret(webhookEnvironment)
    if (!webhookSecret) {
      return NextResponse.json({ error: "Secret webhook non configuré pour cet environnement" }, { status: 503 })
    }
    if (!verifyGeniusPayWebhookSignature({ timestamp, payload, signature, secret: webhookSecret })) {
      return NextResponse.json({ error: "Signature webhook invalide" }, { status: 401 })
    }

    if (event !== "payment.success" && event !== "payment.failed") {
      return NextResponse.json({ received: true, ignored: true })
    }

    const reference = paymentReference(payload)
    if (!reference || reference.length > 128) {
      return NextResponse.json({ error: "Référence de paiement invalide" }, { status: 400 })
    }

    const providerResult = await getGeniusPayPayment(reference, webhookEnvironment)
    if (!providerResult.ok || !providerResult.data) {
      return NextResponse.json({ error: "Vérification GeniusPay indisponible" }, { status: 502 })
    }
    const payment = providerResult.data
    const admin = createAdminClient()
    const { data: order, error: lookupError } = await admin
      .from("orders")
      .select("id, buyer_id, total_amount, currency, payment_status, payment_method, provider_reference")
      .eq("provider_reference", reference)
      .eq("payment_method", "geniuspay")
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (order.currency !== "XOF") {
      return NextResponse.json({ error: "Devise de paiement non prise en charge" }, { status: 422 })
    }

    if (
      !isGeniusPayPaymentForOrder(payment, {
        id: order.id,
        userId: order.buyer_id,
        totalAmount: Math.round(Number(order.total_amount)),
        reference: order.provider_reference,
      })
    ) {
      console.error("[webhooks/geniuspay] payment/order mismatch", { orderId: order.id, reference })
      return NextResponse.json({ error: "Données de paiement non concordantes" }, { status: 422 })
    }

    const success = event === "payment.success"
    const providerStatusMatchesEvent =
      success ? payment.status === "completed" : ["failed", "cancelled"].includes(payment.status)
    if (!providerStatusMatchesEvent) {
      return NextResponse.json({ received: true, pending: true }, { status: 202 })
    }
    const finalStatus = success ? "paid" : "failed"
    if (order.payment_status === finalStatus) {
      if (success) {
        const now = new Date().toISOString()
        const { error: escrowError } = await admin
          .from("escrow_transactions")
          .update({ status: "held", paid_at: now })
          .eq("order_id", order.id)
          .eq("tranche_numero", 1)
          .eq("status", "pending")
        if (escrowError) throw escrowError
      }
      return NextResponse.json({ received: true, duplicate: true })
    }

    if (
      order.payment_status !== "processing" &&
      !(success && order.payment_status === "failed")
    ) {
      return NextResponse.json({ received: true, ignored: true })
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: finalStatus,
        ...(success ? { escrow_status: "held", status: "confirmed" } : {}),
        updated_at: now,
      })
      .eq("id", order.id)
      .in("payment_status", success ? ["processing", "failed"] : ["processing"])
      .eq("provider_reference", reference)
      .select("id")
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) return NextResponse.json({ received: true, duplicate: true })

    if (success) {
      const { error: escrowError } = await admin
        .from("escrow_transactions")
        .update({ status: "held", paid_at: now })
        .eq("order_id", order.id)
        .eq("tranche_numero", 1)
        .eq("status", "pending")
      if (escrowError) throw escrowError
    }

    const { error: auditError } = await admin.from("order_audit_log").insert({
      order_id: order.id,
      action: success ? "geniuspay_webhook_payment_success" : "geniuspay_webhook_payment_failed",
      old_value: order.payment_status,
      new_value: success ? "held" : "failed",
      notes: `GeniusPay ${reference}; delivery=${(request.headers.get("x-webhook-delivery") || "").replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 128) || "not-provided"}`,
    })
    if (auditError) console.error("[webhooks/geniuspay] audit log", auditError.message)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[webhooks/geniuspay]", error)
    return NextResponse.json({ error: "Erreur webhook" }, { status: 500 })
  }
}
