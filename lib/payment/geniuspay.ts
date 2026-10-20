import "server-only"
import { resolvePlatformSecret } from "@/lib/ops/platform-secrets"
import {
  isGeniusPayPaymentForOrder,
  parseGeniusPayPayment,
  type GeniusPayPayment,
} from "@/lib/payment/geniuspay-validation"

const API_URL = "https://geniuspay.ci/api/v1/merchant"

export type GeniusPayCredentials = {
  apiKey: string
  apiSecret: string
}

export type GeniusPayEnvironment = "sandbox" | "live"

export type GeniusPayResult<T> = {
  ok: boolean
  data: T | null
  error?: string
  uncertain?: boolean
}

function keyEnvironment(apiKey: string): GeniusPayEnvironment | null {
  if (apiKey.startsWith("pk_sandbox_")) return "sandbox"
  if (apiKey.startsWith("pk_live_")) return "live"
  return null
}

async function resolveCredentialPair(
  suffix: string,
): Promise<GeniusPayCredentials | null> {
  const keyName = `GENIUSPAY_API_KEY${suffix}`
  const secretName = `GENIUSPAY_API_SECRET${suffix}`
  const [apiKey, apiSecret] = await Promise.all([
    resolvePlatformSecret(keyName),
    resolvePlatformSecret(secretName),
  ])
  return apiKey && apiSecret ? { apiKey, apiSecret } : null
}

export async function resolveGeniusPayCredentials(
  environment?: GeniusPayEnvironment,
): Promise<GeniusPayCredentials | null> {
  if (environment) {
    const environmentCredentials = await resolveCredentialPair(`_${environment.toUpperCase()}`)
    if (environmentCredentials) return environmentCredentials

    const legacyCredentials = await resolveCredentialPair("")
    return legacyCredentials && keyEnvironment(legacyCredentials.apiKey) === environment
      ? legacyCredentials
      : null
  }

  const configuredMode = process.env.GENIUSPAY_MODE?.trim().toLowerCase()
  if (configuredMode === "sandbox" || configuredMode === "live") {
    return resolveGeniusPayCredentials(configuredMode)
  }
  if (configuredMode) return null

  const legacyCredentials = await resolveCredentialPair("")
  if (legacyCredentials) return legacyCredentials

  const [sandboxCredentials, liveCredentials] = await Promise.all([
    resolveCredentialPair("_SANDBOX"),
    resolveCredentialPair("_LIVE"),
  ])
  if (sandboxCredentials && !liveCredentials) return sandboxCredentials
  if (liveCredentials && !sandboxCredentials) return liveCredentials
  return null
}

export async function resolveGeniusPayWebhookSecret(
  environment: GeniusPayEnvironment,
): Promise<string> {
  const environmentSecretName = `GENIUSPAY_WEBHOOK_SECRET_${environment.toUpperCase()}`
  const environmentSecret =
    (process.env[environmentSecretName] || "").trim() ||
    (await resolvePlatformSecret(environmentSecretName))
  if (environmentSecret) return environmentSecret

  const configuredMode = process.env.GENIUSPAY_MODE?.trim().toLowerCase()
  const legacyCredentials = await resolveCredentialPair("")
  if (
    legacyCredentials &&
    keyEnvironment(legacyCredentials.apiKey) === environment &&
    (!configuredMode || configuredMode === environment)
  ) {
    return (
      (process.env.GENIUSPAY_WEBHOOK_SECRET || "").trim() ||
      (await resolvePlatformSecret("GENIUSPAY_WEBHOOK_SECRET"))
    )
  }
  return ""
}

async function geniusPayFetch(
  path: string,
  method: "GET" | "POST",
  environment?: GeniusPayEnvironment,
  body?: Record<string, unknown>,
): Promise<GeniusPayResult<Record<string, unknown>>> {
  const credentials = await resolveGeniusPayCredentials(environment)
  if (!credentials) return { ok: false, data: null, error: "GENIUSPAY_NOT_CONFIGURED" }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "X-API-Key": credentials.apiKey,
        "X-API-Secret": credentials.apiSecret,
        "Content-Type": "application/json",
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
        uncertain: method === "POST" && (response.status >= 500 || response.ok),
      }
    }
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      data: null,
      error: "GENIUSPAY_NETWORK_ERROR",
      uncertain: method === "POST",
    }
  }
}

function validCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      (url.hostname === "geniuspay.ci" || url.hostname.endsWith(".geniuspay.ci"))
    )
  } catch {
    return false
  }
}

export async function createGeniusPayCheckout(input: {
  amount: number
  orderId: string
  userId: string
  description: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  successUrl: string
  errorUrl: string
}): Promise<GeniusPayResult<GeniusPayPayment & { checkoutUrl: string }>> {
  const customer: Record<string, string> = { country: "CI" }
  if (input.customerName) customer.name = input.customerName
  if (input.customerEmail) customer.email = input.customerEmail
  if (input.customerPhone) customer.phone = input.customerPhone

  const result = await geniusPayFetch("/payments", "POST", undefined, {
    amount: input.amount,
    currency: "XOF",
    description: input.description.slice(0, 500),
    customer,
    success_url: input.successUrl,
    error_url: input.errorUrl,
    metadata: { order_id: input.orderId, user_id: input.userId },
  })
  if (!result.ok || !result.data) return { ...result, data: null }

  const payment = parseGeniusPayPayment(result.data, { defaultCurrency: "XOF" })
  const checkoutUrl =
    typeof result.data.checkout_url === "string"
      ? result.data.checkout_url
      : typeof result.data.payment_url === "string"
        ? result.data.payment_url
        : ""
  if (
    !payment ||
    payment.amount !== input.amount ||
    payment.currency !== "XOF" ||
    payment.metadata.order_id !== input.orderId ||
    payment.metadata.user_id !== input.userId ||
    payment.status !== "pending" ||
    !validCheckoutUrl(checkoutUrl)
  ) {
    return {
      ok: false,
      data: null,
      error: "GENIUSPAY_INVALID_CREATE_RESPONSE",
      uncertain: true,
    }
  }
  return { ok: true, data: { ...payment, checkoutUrl } }
}

export async function getGeniusPayPayment(
  reference: string,
  environment?: GeniusPayEnvironment,
): Promise<GeniusPayResult<GeniusPayPayment>> {
  if (!reference || reference.length > 128) {
    return { ok: false, data: null, error: "INVALID_PAYMENT_REFERENCE" }
  }
  const result = await geniusPayFetch(
    `/payments/${encodeURIComponent(reference)}`,
    "GET",
    environment,
  )
  if (!result.ok || !result.data) return { ...result, data: null }
  const payment = parseGeniusPayPayment(result.data)
  return payment
    ? { ok: true, data: payment }
    : { ok: false, data: null, error: "GENIUSPAY_INVALID_STATUS_RESPONSE" }
}

export { isGeniusPayPaymentForOrder }
