import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  getFeexPayReadinessFromEnv,
  isFeexPayPaidStatus,
  isFeexPayFailedStatus,
} from "@/lib/feexpay/readiness"
import {
  hasAfricasTalkingSenderId,
  isSmsDeliveryReady,
} from "@/lib/auth/sms"

describe("FeexPay readiness", () => {
  it("refuse payin live sans webhook", () => {
    const r = getFeexPayReadinessFromEnv({
      FEEXPAY_API_KEY: "k",
      FEEXPAY_SHOP_ID: "s",
      FEEXPAY_MODE: "live",
    })
    expect(r.configured).toBe(true)
    expect(r.mode).toBe("live")
    expect(r.payin_ready).toBe(false)
    expect(r.live_blocked_reason).toMatch(/WEBHOOK/)
  })

  it("autorise sandbox avec clé+shop seuls", () => {
    const r = getFeexPayReadinessFromEnv({
      FEEXPAY_API_KEY: "k",
      FEEXPAY_SHOP_ID: "s",
      FEEXPAY_MODE: "sandbox",
    })
    expect(r.payin_ready).toBe(true)
  })

  it("autorise live avec webhook", () => {
    const r = getFeexPayReadinessFromEnv({
      FEEXPAY_API_KEY: "k",
      FEEXPAY_SHOP_ID: "s",
      FEEXPAY_MODE: "live",
      FEEXPAY_WEBHOOK_SECRET: "whsec",
    })
    expect(r.payin_ready).toBe(true)
    expect(r.webhook_ready).toBe(true)
  })

  it("détecte paid/failed statuses", () => {
    expect(isFeexPayPaidStatus("successful")).toBe(true)
    expect(isFeexPayFailedStatus("cancelled")).toBe(true)
    expect(isFeexPayFailedStatus("processing")).toBe(false)
  })
})

describe("SMS delivery readiness helpers", () => {
  const prev: Record<string, string | undefined> = {}

  beforeEach(() => {
    prev.AT_SENDER_ID = process.env.AT_SENDER_ID
  })

  afterEach(() => {
    if (prev.AT_SENDER_ID === undefined) delete process.env.AT_SENDER_ID
    else process.env.AT_SENDER_ID = prev.AT_SENDER_ID
  })

  it("sender id helper lit AT_SENDER_ID", () => {
    process.env.AT_SENDER_ID = "GWA"
    expect(hasAfricasTalkingSenderId()).toBe(true)
  })

  it("isSmsDeliveryReady est booléen", () => {
    expect(typeof isSmsDeliveryReady()).toBe("boolean")
  })
})
