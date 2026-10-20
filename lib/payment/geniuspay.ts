import "server-only"
import { resolvePlatformSecret } from "@/lib/ops/platform-secrets"
import { isGeniusPayPaymentForOrder } from "@/lib/payment/geniuspay-validation"

const API_URL = "https://geniuspay.ci/api/v1/merchant"

export type GeniusPayCredentials = {
  apiKey: string
  apiSecret: string
}

export type GeniusPayPayment = {
  reference: string
  amount: number
  currency: string
  status: string
  checkoutUrl?: string
  metadata: Record<string, unknown>
}

export type GeniusPayResult<T> = {
  ok: boolean
  data: T | null
  error?: string
  uncertain?: boolean
}

export async function resolveGeniusPayCredentials(): Promise<GeniusPayCredentials | null> {
  const apiKey =
    (process.env.GENIUSPAY_API_KEY || "").trim() ||
    (await resolvePlatformSecret("GENIUSPAY_API_KEY"))
  const apiSecret =
    (process.env.GENIUSPAY_API_SECRET || "").trim() ||
    (await resolvePlatformSecret("GENIUSPAY_API_SECRET"))
  return apiKey && apiSecret ? { apiKey, apiSecret } : null
}

async function geniusPayFetch(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<GeniusPayResult<Record<string, unknown>>> {
  const credentials = await resolveGeniusPayCredentials()
  if (!credentials) return { ok: false, data: null, error: "GENIUSPAY_NOT_CONFIGURED" }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "X-API-Key": credentials.apiKey,
        "X-API-Secret": credentials.apiSecret,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const data =
      payload.data && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : null
    if (!response.ok || payload.success !== true || !data) {
      return {
        ok: false,
        data,
        error: `GENIUSPAY_HTTP_${response.status}`,
      }
    }
    return { ok: true, data }
  } catch {
    return { ok: false, data: null, error: "GENIUSPAY_NETWORK_ERROR", uncertain: method === "POST" }
  }
}

function toPayment(data: Record<string, unknown>): GeniusPayPayment | null {
  const reference =
    typeof data.reference === "string" ? data.reference.trim() : ""
  const amount = Number(data.amount)
  const currency = typeof data.currency === "string" ? data.currency : ""
  const status = typeof data.status === "string" ? data.status.toLowerCase() : ""
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {}
  if (!reference || !Number.isFinite(amount) || !currency || !status) return null
  const checkoutUrl =
    typeof data.checkout_url === "string"
      ? data.checkout_url
      : typeof data.payment_url === "string"
        ? data.payment_url
        : undefined
  return { reference, amount, currency, status, checkoutUrl, metadata }
}

export async function createGeniusPayCheckout(input: {
  amount: number
  orderId: string
  description: string
  customerName?: string
  customerPhone?: string
  successUrl: string
  errorUrl: string
}): Promise<GeniusPayResult<GeniusPayPayment>> {
  const customer: Record<string, string> = { country: "CI" }
  if (input.customerName) customer.name = input.customerName
  if (input.customerPhone) customer.phone = input.customerPhone

  const result = await geniusPayFetch("/payments", "POST", {
    amount: input.amount,
    currency: "XOF",
    description: input.description.slice(0, 500),
    customer,
    success_url: input.successUrl,
    error_url: input.errorUrl,
    metadata: { order_id: input.orderId },
  })
  if (!result.ok || !result.data) return { ...result, data: null }

  const payment = toPayment(result.data)
  if (!payment || payment.amount !== input.amount || payment.currency !== "XOF") {
    return { ok: false, data: null, error: "GENIUSPAY_INVALID_CREATE_RESPONSE" }
  }
  if (payment.status !== "pending" && payment.status !== "processing") {
    return { ok: false, data: null, error: "GENIUSPAY_UNEXPECTED_INITIAL_STATUS" }
  }
  if (!payment.checkoutUrl) {
    return { ok: false, data: null, error: "GENIUSPAY_CHECKOUT_URL_MISSING" }
  }
  try {
    const url = new URL(payment.checkoutUrl)
    if (url.protocol !== "https:" || url.hostname !== "geniuspay.ci") {
      return { ok: false, data: null, error: "GENIUSPAY_INVALID_CHECKOUT_URL" }
    }
  } catch {
    return { ok: false, data: null, error: "GENIUSPAY_INVALID_CHECKOUT_URL" }
  }
  return { ok: true, data: payment }
}

export async function getGeniusPayPayment(
  reference: string,
): Promise<GeniusPayResult<GeniusPayPayment>> {
  if (!reference || reference.length > 128) {
    return { ok: false, data: null, error: "INVALID_PAYMENT_REFERENCE" }
  }
  const result = await geniusPayFetch(
    `/payments/${encodeURIComponent(reference)}`,
    "GET",
  )
  if (!result.ok || !result.data) return { ...result, data: null }
  const payment = toPayment(result.data)
  return payment
    ? { ok: true, data: payment }
    : { ok: false, data: null, error: "GENIUSPAY_INVALID_STATUS_RESPONSE" }
}

export { isGeniusPayPaymentForOrder }
