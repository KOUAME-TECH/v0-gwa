import { describe, expect, it } from "vitest"
import { isPaymentSimulationAllowed } from "@/lib/payment/simulation"

describe("isPaymentSimulationAllowed", () => {
  it("always disables payment simulation in production", () => {
    expect(
      isPaymentSimulationAllowed({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        ALLOW_PAYMENT_SIMULATION: "true",
      }),
    ).toBe(false)
  })

  it("allows explicit simulation outside production", () => {
    expect(
      isPaymentSimulationAllowed({
        NODE_ENV: "test",
        ALLOW_PAYMENT_SIMULATION: "true",
      }),
    ).toBe(true)
  })

  it("allows local development simulation by default", () => {
    expect(isPaymentSimulationAllowed({ NODE_ENV: "development" })).toBe(true)
  })

  it("disables simulation outside local development unless explicitly enabled", () => {
    expect(isPaymentSimulationAllowed({ NODE_ENV: "test" })).toBe(false)
  })
})
