import { describe, expect, it } from "vitest"
import { isExactPaymentAmount } from "@/lib/payment/amount"

describe("isExactPaymentAmount", () => {
  it("accepts the exact FCFA amount", () => {
    expect(isExactPaymentAmount(5000, 5000)).toBe(true)
    expect(isExactPaymentAmount("5000", 5000.2)).toBe(true)
  })

  it("rejects missing, malformed, underpaid, and overpaid amounts", () => {
    expect(isExactPaymentAmount(undefined, 5000)).toBe(false)
    expect(isExactPaymentAmount(null, 5000)).toBe(false)
    expect(isExactPaymentAmount("", 5000)).toBe(false)
    expect(isExactPaymentAmount("invalid", 5000)).toBe(false)
    expect(isExactPaymentAmount(4999, 5000)).toBe(false)
    expect(isExactPaymentAmount(5001, 5000)).toBe(false)
    expect(isExactPaymentAmount(5000.5, 5000)).toBe(false)
  })
})
