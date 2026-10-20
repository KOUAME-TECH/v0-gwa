import { createHmac } from "crypto"
import { describe, expect, it } from "vitest"
import {
  isGeniusPayWebhookEnvelopeConsistent,
  isGeniusPayWebhookTimestampFresh,
  verifyGeniusPayWebhookSignature,
} from "@/lib/payment/geniuspay-webhook-validation"

describe("GeniusPay webhook authentication", () => {
  const secret = "test-webhook-secret"
  const timestamp = "1792497600"
  const payload = {
    id: "delivery-1",
    event: "payment.success",
    data: { reference: "MTX-123", metadata: { order_id: "order-1" } },
    environment: "sandbox",
  }
  const wireBody = `{
  "id": "delivery-1",
  "event": "payment.success",
  "data": { "reference": "MTX-123", "metadata": { "order_id": "order-1" } },
  "environment": "sandbox"
}`
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest("hex")

  it("signs the compact JSON serialization of the parsed webhook payload", () => {
    expect(
      JSON.parse(wireBody),
    ).toEqual(payload)
    expect(
      verifyGeniusPayWebhookSignature({ timestamp, payload: JSON.parse(wireBody), signature, secret }),
    ).toBe(true)
  })

  it("rejects changed payloads, wrong secrets and malformed signatures", () => {
    expect(
      verifyGeniusPayWebhookSignature({
        timestamp,
        payload: { ...payload, environment: "live" },
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

  it("requires the header event and environment to match the signed envelope", () => {
    expect(isGeniusPayWebhookEnvelopeConsistent(payload, "payment.success", "sandbox")).toBe(true)
    expect(isGeniusPayWebhookEnvelopeConsistent(payload, "payment.failed", "sandbox")).toBe(false)
    expect(isGeniusPayWebhookEnvelopeConsistent(payload, "payment.success", "live")).toBe(false)
  })

  it("accepts timestamps only within the five-minute replay window", () => {
    expect(isGeniusPayWebhookTimestampFresh("1000", 1300)).toBe(true)
    expect(isGeniusPayWebhookTimestampFresh("1000", 1301)).toBe(false)
    expect(isGeniusPayWebhookTimestampFresh("700", 1000)).toBe(true)
    expect(isGeniusPayWebhookTimestampFresh("699", 1000)).toBe(false)
    expect(isGeniusPayWebhookTimestampFresh("not-a-timestamp", 1000)).toBe(false)
  })
})
