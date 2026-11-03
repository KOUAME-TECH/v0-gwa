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

function envValue(name: string): string {
  return (process.env[name] || "").replace(/^"|"$/g, "").trim()
}

/** Noms acceptés en production. X_* est le nom déjà posé sur Vercel, sans renommage. */
const LIVE_KEY_NAMES = ["GENIUSPAY_API_KEY", "X_API_Key", "X_API_KEY"] as const
const LIVE_SECRET_NAMES = ["GENIUSPAY_API_SECRET", "X_API_Secret", "X_API_SECRET"] as const
const WEBHOOK_SECRET_NAMES = [
  "GENIUSPAY_WEBHOOK_SECRET",
  "X_Webhook_Secret",
  "X_WEBHOOK_SECRET",
] as const

async function firstSecret(names: readonly string[]): Promise<string> {
  for (const name of names) {
    const fromEnv = envValue(name)
    if (fromEnv) return fromEnv
  }
  const { resolvePlatformSecret } = await import("@/lib/ops/platform-secrets")
  for (const name of names) {
    const value = (await resolvePlatformSecret(name)).trim()
    if (value) return value
  }
  return ""
}

export async function resolveGeniusPayCredentials(mode: GeniusPayEnvironment = "live") {
  const suffix = mode === "sandbox" ? "_SANDBOX" : ""
  const keyNames = mode === "sandbox" ? [`GENIUSPAY_API_KEY${suffix}`] : LIVE_KEY_NAMES
  const secretNames = mode === "sandbox" ? [`GENIUSPAY_API_SECRET${suffix}`] : LIVE_SECRET_NAMES
  const key = await firstSecret(keyNames)
  const secret = await firstSecret(secretNames)
  return key && secret ? { key, secret } : null
}

export async function resolveGeniusPayWebhookSecret() {
  return firstSecret(WEBHOOK_SECRET_NAMES)
}

export function getGeniusPayMode(): GeniusPayEnvironment {
  return process.env.GENIUSPAY_MODE === "sandbox" ? "sandbox" : "live"
}

export async function isGeniusPayConfigured(
  mode: GeniusPayEnvironment = getGeniusPayMode(),
) {
  return Boolean(await resolveGeniusPayCredentials(mode))
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
    const result = await request(
      "/payments",
      {
        method: "POST",
        body: JSON.stringify({
          amount: input.amount,
          currency: "XOF",
          description: input.description,
          customer: input.customer,
          success_url: input.successUrl,
          error_url: input.errorUrl,
          metadata: {
            order_id: input.orderId,
            user_id: input.userId,
            ...(input.metadata ?? {}),
          },
        }),
      },
      getGeniusPayMode(),
    )
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

export async function getGeniusPayPayment(
  reference: string,
  mode: GeniusPayEnvironment = getGeniusPayMode(),
) {
  try {
    const result = await request(`/payments/${encodeURIComponent(reference)}`, { method: "GET" }, mode)
    const data = result.data
    if (!data?.currency || !data.reference) return { ok: false as const, error: "GENIUSPAY_INVALID_STATUS_RESPONSE" }
    return { ok: true as const, data }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "GENIUSPAY_REQUEST_FAILED" }
  }
}
