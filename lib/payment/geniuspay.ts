import "server-only"

const BASE_URL = "https://geniuspay.ci/api/v1/merchant"

type GeniusPayResponse = {
  success?: boolean
  data?: {
    id?: number | string
    reference?: string
    amount?: number
    status?: string
    checkout_url?: string
    payment_url?: string
    metadata?: Record<string, unknown>
  }
  error?: { code?: string; message?: string }
}

export type GeniusPayPayment = NonNullable<GeniusPayResponse["data"]>

function credentials() {
  const key = process.env.GENIUSPAY_API_KEY?.trim()
  const secret = process.env.GENIUSPAY_API_SECRET?.trim()
  return key && secret ? { key, secret } : null
}

export function isGeniusPayConfigured() {
  return Boolean(credentials())
}

async function request(path: string, init: RequestInit): Promise<GeniusPayResponse> {
  const auth = credentials()
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
  if (!response.ok || body.success === false) {
    throw new Error(body.error?.code || `GENIUSPAY_HTTP_${response.status}`)
  }
  return body
}

export async function createGeniusPayPayment(input: {
  amount: number
  description: string
  customer?: { name?: string; email?: string; phone?: string; country?: string }
  metadata: Record<string, string | number>
  successUrl?: string
  errorUrl?: string
}) {
  const result = await request("/payments", {
    method: "POST",
    body: JSON.stringify({ ...input, currency: "XOF" }),
  })
  if (!result.data?.reference) throw new Error("GENIUSPAY_REFERENCE_MISSING")
  return result.data
}

export async function getGeniusPayPayment(reference: string) {
  const result = await request(`/payments/${encodeURIComponent(reference)}`, { method: "GET" })
  return result.data
}
