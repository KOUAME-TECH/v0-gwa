import { describe, expect, it, beforeEach, afterEach } from "vitest"
import {
  hasAfricasTalkingProvider,
  hasAfricasTalkingSenderId,
  isAfricasTalkingLiveUsername,
} from "@/lib/auth/sms"

describe("Africa's Talking config flags", () => {
  const keys = [
    "AT_API_KEY",
    "AT_USERNAME",
    "AT_SENDER_ID",
    "AT_SANDBOX",
    "AFRICASTALKING_API_KEY",
    "AFRICASTALKING_USERNAME",
  ]
  const prev: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k]
      else process.env[k] = prev[k]
    }
  })
  it("detects live username vs sandbox", () => {
    process.env.AT_USERNAME = "sandbox"
    expect(isAfricasTalkingLiveUsername()).toBe(false)
    process.env.AT_USERNAME = "gwaCorp"
    expect(isAfricasTalkingLiveUsername()).toBe(true)
  })
  it("detects key and sender", () => {
    expect(hasAfricasTalkingProvider()).toBe(false)
    process.env.AT_API_KEY = "key"
    expect(hasAfricasTalkingProvider()).toBe(true)
    expect(hasAfricasTalkingSenderId()).toBe(false)
    process.env.AT_SENDER_ID = "GWA"
    expect(hasAfricasTalkingSenderId()).toBe(true)
  })
})

describe("Africa's Talking default sender", () => {
  const keys = ["AT_API_KEY", "AT_USERNAME", "AT_SENDER_ID", "SMS_AT_SENDER_ID", "AFRICASTALKING_FROM", "AFRICASTALKING_SENDER_ID", "AT_SANDBOX"]
  const prev: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of keys) { prev[k] = process.env[k]; delete process.env[k] }
  })
  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k]
      else process.env[k] = prev[k]
    }
  })
  it("sends without the from parameter when no sender is configured", async () => {
    process.env.AT_API_KEY = "key"
    process.env.AT_USERNAME = "gwaLive"
    const { vi } = await import("vitest")
    vi.doMock("@/lib/ops/platform-secrets", () => ({ resolvePlatformSecret: async () => "" }))
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ SMSMessageData: { Recipients: [{ statusCode: 101, status: "Success", messageId: "m1" }] } }), { status: 201 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    vi.resetModules()
    const { sendSmsOtp } = await import("@/lib/auth/sms")
    const res = await sendSmsOtp("+2250700000000", "123456")
    expect(res.success).toBe(true)
    expect(res.warning).toBeUndefined()
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams
    expect(body.has("from")).toBe(false)
    vi.unstubAllGlobals()
    vi.doUnmock("@/lib/ops/platform-secrets")
  })
})
