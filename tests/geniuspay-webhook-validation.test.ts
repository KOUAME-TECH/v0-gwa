import { createHmac } from "crypto"
import { describe, expect, it } from "vitest"
import {
  isGeniusPayWebhookTimestampFresh,
  verifyGeniusPayWebhookSignature,
} from "@/lib/payment/geniuspay-webhook-validation"

describe("GeniusPay webhook authentication", () => {
  const secret = "test-webhook-secret"
  const timestamp = "1792497600"
  const rawBody = '{"reference":"MTX-123","metadata":{"order_id":"order-1"}}'
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")

  it("accepts the documented timestamped HMAC-SHA256 signature", () => {
    expect(
      verifyGeniusPayWebhookSignature({ timestamp, rawBody, signature, secret }),
    ).toBe(true)
  })

  it("rejects changed payloads, wrong secrets and malformed signatures", () => {
    expect(
      verifyGeniusPayWebhookSignature({
        timestamp,
        rawBody: `${rawBody} `,
        signature,
        secret,
      }),
    ).toBe(false)
    expect(
      verifyGeniusPayWebhookSignature({ timestamp, rawBody, signature, secret: "wrong" }),
    ).toBe(false)
    expect(
      verifyGeniusPayWebhookSignature({ timestamp, rawBody, signature: "bad", secret }),
    ).toBe(false)
  })

  it("accepts timestamps only within the five-minute replay window", () => {
    expect(isGeniusPayWebhookTimestampFresh("1000", 1300)).toBe(true)
    expect(isGeniusPayWebhookTimestampFresh("1000", 1301)).toBe(false)
    expect(isGeniusPayWebhookTimestampFresh("700", 1000)).toBe(true)
    expect(isGeniusPayWebhookTimestampFresh("699", 1000)).toBe(false)
    expect(isGeniusPayWebhookTimestampFresh("not-a-timestamp", 1000)).toBe(false)
  })
})
