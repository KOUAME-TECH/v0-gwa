/**
 * Client FeexPay — pay-in (requesttopay) + payout (escrow applicatif GWA).
 * Docs : https://docs.feexpay.me — endpoints CI : orange_ci, mtn_ci, moov_ci, wave_ci
 */
import "server-only"
import {
  mapPaymentMethodToNetwork,
  normalizeFeexPayPhone,
  type FeexPayNetwork,
} from "@/lib/feexpay/networks"

export type { FeexPayNetwork }
export { mapPaymentMethodToNetwork, normalizeFeexPayPhone }

export type FeexPayCredentials = {
  apiKey: string
  shopId: string
  mode: "sandbox" | "live"
}

export type FeexPayPayInResult = {
  ok: boolean
  reference: string | null
  paymentUrl: string | null
  status: string | null
  raw: Record<string, unknown>
  error?: string
}

export type FeexPayPayoutResult = {
  ok: boolean
  reference: string | null
  status: string | null
  raw: Record<string, unknown>
  error?: string
}

const BASE_URL = "https://api.feexpay.me"

function trimEnv(name: string): string {
  return (process.env[name] || "").replace(/^"|"$/g, "").trim()
}

export function getFeexPayCredentials(): FeexPayCredentials | null {
  const apiKey = trimEnv("FEEXPAY_API_KEY")
  const shopId = trimEnv("FEEXPAY_SHOP_ID")
  if (!apiKey || !shopId) return null
  const modeRaw = (process.env.FEEXPAY_MODE || "sandbox").toLowerCase()
  const mode = modeRaw === "live" || modeRaw === "prod" || modeRaw === "production"
    ? "live"
    : "sandbox"
  return { apiKey, shopId, mode }
}

/** Env Vercel d'abord, puis platform_secrets (service_role). */
export async function resolveFeexPayCredentials(): Promise<FeexPayCredentials | null> {
  const fromEnv = getFeexPayCredentials()
  if (fromEnv) return fromEnv

  const { resolvePlatformSecret } = await import("@/lib/ops/platform-secrets")
  const apiKey = await resolvePlatformSecret("FEEXPAY_API_KEY")
  const shopId = await resolvePlatformSecret("FEEXPAY_SHOP_ID")
  if (!apiKey || !shopId) return null

  const modeRaw = (
    trimEnv("FEEXPAY_MODE") ||
    (await resolvePlatformSecret("FEEXPAY_MODE")) ||
    "sandbox"
  ).toLowerCase()
  const mode =
    modeRaw === "live" || modeRaw === "prod" || modeRaw === "production"
      ? "live"
      : "sandbox"
  return { apiKey, shopId, mode }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return null
}

async function feexFetch(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    data = {}
  }
  return { ok: res.ok, status: res.status, data }
}

export async function createFeexPayPayIn(input: {
  amountFcfa: number
  phone: string
  network: FeexPayNetwork
  description?: string
  firstName?: string
  lastName?: string
  returnUrl?: string
  callbackInfo?: string
}): Promise<FeexPayPayInResult> {
  const creds = await resolveFeexPayCredentials()
  if (!creds) {
    return {
      ok: false,
      reference: null,
      paymentUrl: null,
      status: null,
      raw: {},
      error: "FEEXPAY_NOT_CONFIGURED",
    }
  }

  const phone = normalizeFeexPayPhone(input.phone)
  if (!phone) {
    return {
      ok: false,
      reference: null,
      paymentUrl: null,
      status: null,
      raw: {},
      error: "INVALID_PHONE",
    }
  }

  const amount = Math.max(100, Math.round(input.amountFcfa))
  const body: Record<string, unknown> = {
    shop: creds.shopId,
    amount,
    phoneNumber: phone,
    description: (input.description || "Commande GWA").replace(/[^\w\s\-àâäéèêëïîôùûüç]/gi, "").slice(0, 120),
  }
  if (input.firstName) body.firstName = input.firstName.slice(0, 60)
  if (input.lastName) body.lastName = input.lastName.slice(0, 60)
  if (input.returnUrl) body.return_url = input.returnUrl
  if (input.callbackInfo) body.callback_info = input.callbackInfo

  const path = `/api/transactions/public/requesttopay/${input.network}`
  try {
    const { ok, data } = await feexFetch(path, creds.apiKey, body)
    const reference = pickString(data, [
      "reference",
      "transref",
      "order_id",
      "ref",
      "transaction_id",
    ])
    const paymentUrl = pickString(data, ["payment_url", "url", "paymentUrl", "redirect_url"])
    const status = pickString(data, ["status", "payment_status", "responsemsg"])
    return {
      ok: ok && (!!reference || !!paymentUrl),
      reference,
      paymentUrl,
      status,
      raw: data,
      error: ok ? undefined : pickString(data, ["message", "error", "responsemsg"]) || "PAYIN_FAILED",
    }
  } catch (err) {
    return {
      ok: false,
      reference: null,
      paymentUrl: null,
      status: null,
      raw: {},
      error: err instanceof Error ? err.message : "PAYIN_NETWORK_ERROR",
    }
  }
}

export async function createFeexPayPayout(input: {
  amountFcfa: number
  phone: string
  network: FeexPayNetwork
  description?: string
}): Promise<FeexPayPayoutResult> {
  const creds = await resolveFeexPayCredentials()
  if (!creds) {
    return {
      ok: false,
      reference: null,
      status: null,
      raw: {},
      error: "FEEXPAY_NOT_CONFIGURED",
    }
  }

  const phone = normalizeFeexPayPhone(input.phone)
  if (!phone) {
    return {
      ok: false,
      reference: null,
      status: null,
      raw: {},
      error: "INVALID_PHONE",
    }
  }

  const amount = Math.max(50, Math.round(input.amountFcfa))
  const body: Record<string, unknown> = {
    shop: creds.shopId,
    amount,
    phoneNumber: phone,
    description: (input.description || "Liberation escrow GWA").replace(/[^\w\s\-]/gi, "").slice(0, 120),
  }

  const path = `/api/payouts/public/${input.network}`
  try {
    const { ok, data } = await feexFetch(path, creds.apiKey, body)
    const reference = pickString(data, [
      "reference",
      "transref",
      "order_id",
      "ref",
      "transaction_id",
      "payout_id",
    ])
    const status = pickString(data, ["status", "payment_status", "responsemsg"])
    return {
      ok: ok && !!reference,
      reference,
      status,
      raw: data,
      error: ok ? undefined : pickString(data, ["message", "error", "responsemsg"]) || "PAYOUT_FAILED",
    }
  } catch (err) {
    return {
      ok: false,
      reference: null,
      status: null,
      raw: {},
      error: err instanceof Error ? err.message : "PAYOUT_NETWORK_ERROR",
    }
  }
}

export async function verifyFeexPayTransaction(
  reference: string,
): Promise<{ ok: boolean; status: string | null; raw: Record<string, unknown> }> {
  const creds = await resolveFeexPayCredentials()
  if (!creds || !reference) {
    return { ok: false, status: null, raw: {} }
  }
  try {
    const res = await fetch(
      `${BASE_URL}/api/transactions/public/single/status/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          Accept: "application/json",
        },
      },
    )
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const status = pickString(data, ["status", "payment_status"])
    return { ok: res.ok, status, raw: data }
  } catch {
    return { ok: false, status: null, raw: {} }
  }
}
