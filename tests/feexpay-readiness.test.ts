import { describe, expect, it } from "vitest"
import {
  getFeexPayReadinessFromConfig,
  parseFeexPayMode,
} from "@/lib/feexpay/readiness"

describe("FeexPay readiness", () => {
  it("requires credentials before enabling payments", () => {
    expect(
      getFeexPayReadinessFromConfig({
        apiKey: "",
        shopId: "",
        webhookSecret: "",
        mode: "sandbox",
      }),
    ).toMatchObject({
      configured: false,
      payin_ready: false,
      payout_ready: false,
      live_blocked_reason: "FEEXPAY_API_KEY + FEEXPAY_SHOP_ID requis",
    })
  })

  it("allows sandbox credentials without a webhook secret", () => {
    expect(
      getFeexPayReadinessFromConfig({
        apiKey: "api-key",
        shopId: "shop",
        webhookSecret: "",
        mode: "sandbox",
      }),
    ).toMatchObject({
      configured: true,
      webhook_ready: false,
      payin_ready: true,
      payout_ready: true,
      live_blocked_reason: null,
    })
  })

  it("blocks live payments until a webhook secret is configured", () => {
    expect(
      getFeexPayReadinessFromConfig({
        apiKey: "api-key",
        shopId: "shop",
        webhookSecret: "",
        mode: "live",
      }),
    ).toMatchObject({
      configured: true,
      webhook_ready: false,
      payin_ready: false,
      payout_ready: false,
      live_blocked_reason: "FEEXPAY_WEBHOOK_SECRET requis en mode live",
    })
  })

  it("allows live payments with a webhook secret and parses production aliases", () => {
    expect(parseFeexPayMode("production")).toBe("live")
    expect(
      getFeexPayReadinessFromConfig({
        apiKey: "api-key",
        shopId: "shop",
        webhookSecret: "webhook-secret",
        mode: "live",
      }),
    ).toMatchObject({
      configured: true,
      webhook_ready: true,
      payin_ready: true,
      payout_ready: true,
      live_blocked_reason: null,
    })
  })
})
