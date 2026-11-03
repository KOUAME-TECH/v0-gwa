import { describe, expect, it } from "vitest"
import { formatFcfa, planForTier, SELLER_PLANS } from "@/lib/pricing/plans"
import { SUBSCRIPTION_PRICES_FCFA } from "@/lib/pricing/service-fee"

describe("seller plans", () => {
  it("exposes Free / Starter 2500 / Pro 7500 / Enterprise devis", () => {
    expect(SELLER_PLANS.map((p) => p.tier)).toEqual([
      "free",
      "starter",
      "pro",
      "enterprise",
    ])
    expect(planForTier("starter").priceFcfa).toBe(2_500)
    expect(planForTier("pro").priceFcfa).toBe(7_500)
    expect(planForTier("enterprise").priceFcfa).toBeNull()
    expect(SUBSCRIPTION_PRICES_FCFA.starter).toBe(2_500)
  })

  it("formats FCFA", () => {
    expect(formatFcfa(7500)).toMatch(/7/)
  })
})
