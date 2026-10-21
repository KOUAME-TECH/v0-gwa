export type FeexPayMode = "sandbox" | "live"

export function parseFeexPayMode(raw: string | undefined): FeexPayMode {
  const mode = (raw || "sandbox").replace(/^"|"$/g, "").trim().toLowerCase()
  return mode === "live" || mode === "prod" || mode === "production"
    ? "live"
    : "sandbox"
}

export function getFeexPayReadinessFromConfig(config: {
  apiKey: string
  shopId: string
  webhookSecret: string
  mode: FeexPayMode
}) {
  const configured = Boolean(config.apiKey && config.shopId)
  const webhook_ready = Boolean(config.webhookSecret)
  const liveBlocked = configured && config.mode === "live" && !webhook_ready

  return {
    configured,
    mode: config.mode,
    webhook_ready,
    payin_ready: configured && !liveBlocked,
    payout_ready: configured && !liveBlocked,
    live_blocked_reason: !configured
      ? "FEEXPAY_API_KEY + FEEXPAY_SHOP_ID requis"
      : liveBlocked
        ? "FEEXPAY_WEBHOOK_SECRET requis en mode live"
        : null,
  }
}
