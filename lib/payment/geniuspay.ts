import "server-only"

const BASE_URL = "https://geniuspay.ci/api/v1/merchant"

type GeniusPayResponse = {
  success?: boolean
  data?: {
    id?: number | string
    reference?: string
    amount?: number
    currency?: string
    status?: string
    checkout_url?: string
    payment_url?: string
    metadata?: Record<string, unknown>
  }
  error?: { code?: string; message?: string }
}

export type GeniusPayEnvironment = "live" | "sandbox"
export type GeniusPayPayment = NonNullable<GeniusPayResponse["data"]>

export async function resolveGeniusPayCredentials(mode: GeniusPayEnvironment = "live") {
  const suffix = mode === "sandbox" ? "_SANDBOX" : ""
  const key = process.env[`GENIUSPAY_API_KEY${suffix}`]
  const secret = process.env[`GENIUSPAY_API_SECRET${suffix}`]
  if (key && secret) return { key, secret }
  const { resolvePlatformSecret } = await import("@/lib/ops/platform-secrets")
  const [platformKey, platformSecret] = await Promise.all([
    resolvePlatformSecret(`GENIUSPAY_API_KEY${suffix}`),
    resolvePlatformSecret(`GENIUSPAY_API_SECRET${suffix}`),
  ])
  return platformKey && platformSecret ? { key: platformKey, secret: platformSecret } : null
}

export async function resolveGeniusPayWebhookSecret() {
  const value = process.env.GENIUSPAY_WEBHOOK_SECRET
  if (value) return value
  const { resolvePlatformSecret } = await import("@/lib/ops/platform-secrets")
  return resolvePlatformSecret("GENIUSPAY_WEBHOOK_SECRET")
}

export async function isGeniusPayConfigured() {
  return Boolean(await resolveGeniusPayCredentials())
}

async function request(path: string, init: RequestInit, mode: GeniusPayEnvironment = "live") {
  const auth = await resolveGeniusPayCredentials(mode)
  if (!auth) throw new Error("GENIUSPAY_NOT_CONFIGURED")
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": auth.key,
      "X-API-Secret": auth.secret,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  const body = (await response.json().catch(() => ({}))) as GeniusPayResponse
  if (!response.ok || body.success === false) throw new Error(body.error?.code || `GENIUSPAY_HTTP_${response.status}`)
  return body
}

export async function createGeniusPayCheckout(input: {
  amount: number
  orderId: string
  userId: string
  description: string
  customer?: { name?: string; email?: string; phone?: string; country?: string }
  metadata?: Record<string, string | number>
  successUrl?: string
  errorUrl?: string
}) {
  try {
    const result = await request("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amount,
        currency: "XOF",
        description: input.description,
        customer: input.customer,
        successUrl: input.successUrl,
        errorUrl: input.errorUrl,
        metadata: { order_id: input.orderId, user_id: input.userId, ...(input.metadata ?? {}) },
      }),
    })
    const data = result.data
    if (!data?.reference) return { ok: false as const, error: "GENIUSPAY_REFERENCE_MISSING" }
    return {
      ok: true as const,
      data: {
        reference: data.reference,
        checkoutUrl: data.payment_url || data.checkout_url,
        checkout_url: data.checkout_url,
        payment_url: data.payment_url,
      },
    }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "GENIUSPAY_REQUEST_FAILED" }
  }
}

export async function createGeniusPayPayment(input: Parameters<typeof createGeniusPayCheckout>[0]) {
  const result = await createGeniusPayCheckout(input)
  if (!result.ok) throw new Error(result.error)
  return result.data
}

export async function getGeniusPayPayment(reference: string, mode: GeniusPayEnvironment = "live") {
  try {
    const result = await request(`/payments/${encodeURIComponent(reference)}`, { method: "GET" }, mode)
    const data = result.data
    if (!data?.currency || !data.reference) return { ok: false as const, error: "GENIUSPAY_INVALID_STATUS_RESPONSE" }
    return { ok: true as const, data }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "GENIUSPAY_REQUEST_FAILED" }
  }
}
