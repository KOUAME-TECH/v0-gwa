import { describe, expect, it } from "vitest"
import {
  isGeniusPayPaymentForOrder,
  isGeniusPaySuccessStatus,
  parseGeniusPayPayment,
} from "@/lib/payment/geniuspay-validation"

const order = { id: "order-123", totalAmount: 2500, reference: "gp-ref-123" }
const payment = {
  reference: "gp-ref-123",
  amount: 2500,
  currency: "XOF",
  status: "pending",
  metadata: { order_id: "order-123" },
}

describe("GeniusPay payment/order validation", () => {
  it("accepts an exact reference, amount, currency and order match", () => {
    expect(isGeniusPayPaymentForOrder(payment, order)).toBe(true)
  })

  it("rejects mismatched references, amounts, currencies and metadata", () => {
    expect(isGeniusPayPaymentForOrder({ ...payment, reference: "other" }, order)).toBe(false)
    expect(isGeniusPayPaymentForOrder({ ...payment, amount: 2499 }, order)).toBe(false)
    expect(isGeniusPayPaymentForOrder({ ...payment, currency: "USD" }, order)).toBe(false)
    expect(
      isGeniusPayPaymentForOrder({ ...payment, metadata: { order_id: "other" } }, order),
    ).toBe(false)
  })

  it("requires an explicit currency when parsing provider status responses", () => {
    const { currency: _, ...withoutCurrency } = payment
    expect(parseGeniusPayPayment(withoutCurrency)).toBeNull()
    expect(parseGeniusPayPayment(withoutCurrency, { defaultCurrency: "XOF" })?.currency).toBe("XOF")
  })

  it("does not treat a provider status as paid until an approved success value is configured", () => {
    expect(isGeniusPaySuccessStatus("completed", undefined)).toBe(false)
    expect(isGeniusPaySuccessStatus("completed", "paid")).toBe(false)
    expect(isGeniusPaySuccessStatus("completed", " COMPLETED ")).toBe(true)
  })
})
