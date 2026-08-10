/**
 * Readiness FeexPay — importable côté tests (pas de server-only).
 */

export type FeexPayMode = "sandbox" | "live"

export function parseFeexPayMode(raw: string | undefined): FeexPayMode {
  const modeRaw = (raw || "sandbox").toLowerCase()
  return modeRaw === "live" || modeRaw === "prod" || modeRaw === "production"
    ? "live"
    : "sandbox"
}

export function getFeexPayReadinessFromEnv(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean
  mode: FeexPayMode
  webhook_ready: boolean
  payin_ready: boolean
  payout_ready: boolean
  live_blocked_reason: string | null
} {
  const apiKey = (env.FEEXPAY_API_KEY || "").replace(/^"|"$/g, "").trim()
  const shopId = (env.FEEXPAY_SHOP_ID || "").replace(/^"|"$/g, "").trim()
  const webhook = !!(env.FEEXPAY_WEBHOOK_SECRET || "").replace(/^"|"$/g, "").trim()
  const mode = parseFeexPayMode(env.FEEXPAY_MODE)
  if (!apiKey || !shopId) {
    return {
      configured: false,
      mode,
      webhook_ready: webhook,
      payin_ready: false,
      payout_ready: false,
      live_blocked_reason: "FEEXPAY_API_KEY + FEEXPAY_SHOP_ID requis",
    }
  }
  const liveNeedsWebhook = mode === "live" && !webhook
  return {
    configured: true,
    mode,
    webhook_ready: webhook,
    payin_ready: !liveNeedsWebhook,
    payout_ready: !liveNeedsWebhook,
    live_blocked_reason: liveNeedsWebhook
      ? "FEEXPAY_WEBHOOK_SECRET requis en mode live"
      : null,
  }
}

export function isFeexPayPaidStatus(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase()
  return (
    s === "success" ||
    s === "paid" ||
    s === "successful" ||
    s === "completed" ||
    s === "approved"
  )
}

export function isFeexPayFailedStatus(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase()
  return (
    s === "failed" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "rejected" ||
    s === "expired" ||
    s === "error"
  )
}
