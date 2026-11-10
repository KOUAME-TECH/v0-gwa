import "server-only"

const BASE_URLS = [
  "https://geniuspay.ci/api/v1/merchant",
  "https://pay.genius.ci/api/v1/merchant",
]

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
  let lastError = "GENIUSPAY_REQUEST_FAILED"
  for (const base of BASE_URLS) {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "X-API-Key": auth.key,
        "X-API-Secret": auth.secret,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    })
    const raw = await response.text()
    let parsed = false
    let body: GeniusPayResponse = {}
    try {
      body = raw ? (JSON.parse(raw) as GeniusPayResponse) : {}
      parsed = true
    } catch {
      parsed = false
    }
    const host = (() => {
      try {
        return new URL(response.url).host
      } catch {
        return base
      }
    })()
    if (parsed && response.ok && body?.success !== false) {
      return body
    }
    const title = raw.match(/<title>([^<]{0,80})/i)?.[1]?.trim() || null
    const snippet = raw
      .replace(/\+?\d{8,15}/g, "[phone]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .slice(0, 240)
    console.error("[geniuspay] http", {
      host,
      status: response.status,
      type: response.headers.get("content-type"),
      bytes: raw.length,
      parsed,
      title,
      code: body?.error?.code || null,
      snippet,
    })
    lastError = body?.error?.code || `GENIUSPAY_HTTP_${response.status}`
    if (parsed) break
  }
  throw new Error(lastError)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === "string" ? value.trim() : ""
}

/** Accepte data.reference, un objet racine, ou l'URL /checkout/<référence>. */
export function extractGeniusPayPayment(body: unknown): {
  reference: string
  payment_url?: string
  checkout_url?: string
} | null {
  const records: Record<string, unknown>[] = []
  const root = asRecord(body)
  if (root) {
    records.push(root)
    const data = asRecord(root.data)
    if (data) {
      records.push(data)
      const nested = asRecord(data.payment) || asRecord(data.transaction)
      if (nested) records.push(nested)
    }
    const payment = asRecord(root.payment)
    if (payment) records.push(payment)
  }
  for (const record of records) {
    const paymentUrl = stringField(record, "payment_url")
    const checkoutUrl = stringField(record, "checkout_url") || stringField(record, "checkoutUrl")
    const fromUrl = (paymentUrl || checkoutUrl).match(/\/checkout\/([A-Za-z0-9_-]+)/)?.[1] || ""
    const reference = stringField(record, "reference") || fromUrl
    if (!reference) continue
    return {
      reference,
      payment_url: paymentUrl || undefined,
      checkout_url: checkoutUrl || undefined,
    }
  }
  return null
}

function paymentShape(body: unknown) {
  const root = asRecord(body)
  const data = root ? root.data : undefined
  return {
    top: root ? Object.keys(root) : [],
    dataType: data == null ? "empty" : Array.isArray(data) ? "array" : typeof data,
    dataKeys: asRecord(data) ? Object.keys(asRecord(data) as Record<string, unknown>) : [],
  }
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
  const payload = (customer: typeof input.customer, withMetadata: boolean) =>
    JSON.stringify({
      amount: input.amount,
      currency: "XOF",
      description: input.description,
      customer,
      success_url: input.successUrl,
      error_url: input.errorUrl,
      ...(withMetadata
        ? {
            metadata: {
              order_id: input.orderId,
              user_id: input.userId,
              ...(input.metadata ?? {}),
            },
          }
        : {}),
    })
  try {
    let result: GeniusPayResponse
    try {
      result = await request(
        "/payments",
        { method: "POST", body: payload(input.customer, true) },
        getGeniusPayMode(),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (!message.includes("422")) throw error
      const customer = input.customer
        ? { name: input.customer.name, phone: input.customer.phone, country: input.customer.country }
        : undefined
      result = await request(
        "/payments",
        { method: "POST", body: payload(customer, false) },
        getGeniusPayMode(),
      )
    }
    const data = extractGeniusPayPayment(result)
    if (!data?.reference) {
      console.error("[geniuspay] payment shape", {
        ...paymentShape(result),
        meta: (result as { _meta?: unknown })._meta ?? null,
      })
      return { ok: false as const, error: "GENIUSPAY_REFERENCE_MISSING" }
    }
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
