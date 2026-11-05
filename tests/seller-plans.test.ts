import { describe, expect, it } from "vitest"
import { formatFcfa, planForTier, SELLER_PLANS } from "@/lib/pricing/plans"
import { SUBSCRIPTION_PRICES_FCFA } from "@/lib/pricing/service-fee"

describe("seller plans", () => {
  it("exposes Graine / Pousse 3000 / Récolte 8000 / Fédération devis", () => {
    expect(SELLER_PLANS.map((p) => p.tier)).toEqual([
      "free",
      "starter",
      "pro",
      "enterprise",
    ])
    expect(planForTier("starter").priceFcfa).toBe(3_000)
    expect(planForTier("pro").priceFcfa).toBe(8_000)
    expect(planForTier("enterprise").priceFcfa).toBeNull()
    expect(SUBSCRIPTION_PRICES_FCFA.starter).toBe(3_000)
  })

  it("formats FCFA", () => {
    expect(formatFcfa(7500)).toMatch(/7/)
  })
})
