import { createHmac, timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { isExactPaymentAmount } from "@/lib/payment/amount"
import {
  getGeniusPayMode,
  getPayment,
  resolveGeniusPayWebhookSecret,
  type GeniusPayEnvironment,
} from "@/lib/payment/geniuspay"
import {
  isGeniusPaySuccessStatus,
  parseGeniusPayPayment,
  type GeniusPayPayment,
} from "@/lib/payment/geniuspay-validation"
import { payInLedgerLines, recordLedgerLines } from "@/lib/features/payments/ledger"

export type GeniusPayWebhookResult = {
  status: number
  body: Record<string, unknown>
}

const REPLAY_WINDOW_SECONDS = 300

type OrderRow = {
  id: string
  total_amount: number | string
  payment_status: string
  fulfillment_mode: string | null
  currency: string | null
}

function verifyRawHmac(raw: string, signature: string, timestamp: string, secret: string): boolean {
  if (!signature || !/^\d+$/.test(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > REPLAY_WINDOW_SECONDS) return false
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature.replace(/^sha256=/i, "").trim())
  return a.length === b.length && timingSafeEqual(a, b)
}

function isSandboxLabel(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "sandbox"
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function envelopeIsSandbox(payload: Record<string, unknown>): boolean {
  const nested = asRecord(payload.data)
  // L'en-tête X-Webhook-Environment n'est pas couvert par le HMAC : on ne s'y fie pas.
  return isSandboxLabel(payload.environment) || isSandboxLabel(nested?.environment)
}

function readReference(payload: Record<string, unknown>): string {
  const top = readString(payload.reference)
  if (top) return top
  return readString(asRecord(payload.data)?.reference)
}

function readOrder(data: unknown): OrderRow | null {
  const row = asRecord(data)
  if (!row) return null
  const id = readString(row.id)
  const total = row.total_amount
  if (!id || (typeof total !== "number" && typeof total !== "string")) return null
  return {
    id,
    total_amount: total,
    payment_status: readString(row.payment_status),
    fulfillment_mode: readString(row.fulfillment_mode) || null,
    currency: readString(row.currency) || null,
  }
}

function orderIdMatches(metadata: Record<string, unknown>, orderId: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(metadata, "order_id")) return true
  const value = metadata.order_id
  if (value == null) return true
  const text = typeof value === "string" ? value.trim() : String(value).trim()
  if (!text) return true
  return text === orderId
}

function paymentMatchesOrder(
  payment: GeniusPayPayment,
  order: OrderRow,
  expectedReference: string,
): boolean {
  const currency = (order.currency || "XOF").trim().toUpperCase()
  return (
    isExactPaymentAmount(payment.amount, order.total_amount) &&
    payment.currency.trim().toUpperCase() === currency &&
    payment.reference === expectedReference &&
    orderIdMatches(payment.metadata, order.id)
  )
}

function providerCode(error: string): string {
  return /^[A-Z][A-Z0-9_]+$/.test(error) ? error : "GENIUSPAY_REQUEST_FAILED"
}

function unavailable(code: string): GeniusPayWebhookResult {
  return {
    status: 503,
    body: { error: "Vérification GeniusPay indisponible", code },
  }
}

export async function handleGeniusPayWebhook(
  raw: string,
  headers: Headers,
): Promise<GeniusPayWebhookResult> {
  const secret = await resolveGeniusPayWebhookSecret()
  if (!secret) {
    return { status: 503, body: { error: "Webhook non configuré" } }
  }

  const signature = headers.get("x-webhook-signature") || ""
  const timestamp = headers.get("x-webhook-timestamp") || ""
  if (!verifyRawHmac(raw, signature, timestamp, secret)) {
    const staleOrMissing =
      !signature ||
      !/^\d+$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > REPLAY_WINDOW_SECONDS
    return {
      status: 401,
      body: { error: staleOrMissing ? "Webhook invalide" : "Signature invalide" },
    }
  }

  let payload: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    const record = asRecord(parsed)
    if (!record) return { status: 400, body: { error: "Payload invalide" } }
    payload = record
  } catch {
    return { status: 400, body: { error: "Payload invalide" } }
  }

  const reference = readReference(payload)
  if (!reference) {
    return { status: 400, body: { error: "reference manquante" } }
  }

  const mode: GeniusPayEnvironment = getGeniusPayMode()
  if (mode === "live" && envelopeIsSandbox(payload)) {
    return {
      status: 409,
      body: { error: "Environnement webhook incompatible (sandbox vs live)" },
    }
  }

  const admin = createAdminClient()
  const { data, error: lookupError } = await admin
    .from("orders")
    .select("id,total_amount,payment_status,escrow_status,fulfillment_mode,currency")
    .eq("payment_reference", reference)
    .maybeSingle()

  if (lookupError) {
    console.error("[webhooks/geniuspay] order lookup", lookupError.message.slice(0, 120))
    return { status: 503, body: { error: "Lecture de la commande indisponible" } }
  }
  if (!data) {
    return { status: 200, body: { received: true, matched: false } }
  }

  const order = readOrder(data)
  if (!order) {
    return { status: 422, body: { error: "Commande illisible" } }
  }

  // Déjà payé : accuser réception sans second GET ni seconde écriture.
  if (order.payment_status === "paid") {
    return { status: 200, body: { received: true, matched: true, idempotent: true } }
  }

  let fetched: Awaited<ReturnType<typeof getPayment>>
  try {
    fetched = await getPayment(reference, mode)
  } catch {
    return unavailable("GENIUSPAY_REQUEST_FAILED")
  }
  if (!fetched.ok || !fetched.data) {
    return unavailable(fetched.ok ? "GENIUSPAY_EMPTY" : providerCode(fetched.error))
  }

  if (mode === "live" && isSandboxLabel(fetched.data.environment)) {
    return { status: 409, body: { error: "Paiement sandbox refusé en mode live" } }
  }

  const payment = parseGeniusPayPayment({
    reference: fetched.data.reference,
    amount: fetched.data.amount,
    currency: fetched.data.currency,
    status: fetched.data.status,
    metadata: fetched.data.metadata ?? {},
  })
  if (!payment) {
    return unavailable("GENIUSPAY_INVALID_STATUS_RESPONSE")
  }

  if (!paymentMatchesOrder(payment, order, reference)) {
    console.error("[webhooks/geniuspay] payment mismatch", { orderId: order.id, reference })
    return { status: 422, body: { error: "Paiement GeniusPay non concordant" } }
  }

  if (!isGeniusPaySuccessStatus(payment.status)) {
    return {
      status: 200,
      body: { received: true, matched: true, pending: true, status: payment.status },
    }
  }

  const { data: paidRows, error: payErr } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      escrow_status: "held",
      status: order.fulfillment_mode === "preorder" ? "paid_preorder" : "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .neq("payment_status", "paid")
    .select("id")

  if (payErr) {
    console.error("[webhooks/geniuspay] order update", payErr.message.slice(0, 120))
    return { status: 500, body: { error: "Le paiement n’a pas pu être enregistré." } }
  }
  if (!paidRows?.length) {
    return { status: 200, body: { received: true, matched: true, idempotent: true } }
  }

  await admin
    .from("escrow_transactions")
    .update({ status: "held", paid_at: new Date().toISOString() })
    .eq("order_id", order.id)

  await admin.from("order_audit_log").insert({
    order_id: order.id,
    performed_by: null,
    action: "geniuspay_webhook_paid",
    new_value: "held",
    notes: `reference=${reference}`,
  })

  const ledger = await recordLedgerLines(
    admin as never,
    payInLedgerLines({
      transactionId: order.id,
      totalPaid: Number(order.total_amount) || 0,
      currency: order.currency || "XOF",
    }),
  )
  if (!ledger.ok) console.error("[webhooks/geniuspay] ledger", ledger.error)

  return { status: 200, body: { received: true, matched: true, verified: true } }
}
