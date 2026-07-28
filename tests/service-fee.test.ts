import { describe, expect, it } from "vitest"
import {
  computeSellerCommission,
  computeServiceFee,
  normalizeSubscriptionTier,
  sellerCommissionRateForTier,
  SUBSCRIPTION_PRICES_FCFA,
} from "@/lib/pricing/service-fee"

describe("seller commission (DG 28/07)", () => {
  it("normalizes aliases", () => {
    expect(normalizeSubscriptionTier(null)).toBe("free")
    expect(normalizeSubscriptionTier("PRO")).toBe("pro")
    expect(normalizeSubscriptionTier("entreprise")).toBe("enterprise")
    expect(normalizeSubscriptionTier("business")).toBe("enterprise")
  })

  it("rates: free 8%, starter 6.5%, pro 5%", () => {
    expect(sellerCommissionRateForTier("free")).toBe(0.08)
    expect(sellerCommissionRateForTier("starter")).toBe(0.065)
    expect(sellerCommissionRateForTier("pro")).toBe(0.05)
    expect(sellerCommissionRateForTier("enterprise")).toBe(0.05)
  })

  it("computes seller commission on subtotal; buyer fee 0", () => {
    const free = computeSellerCommission(100_000, "free")
    expect(free.commissionFcfa).toBe(8_000)
    expect(free.vendeurRecoitFcfa).toBe(92_000)
    expect(free.buyerServiceFee).toBe(0)
    expect(free.pctLabel).toBe("8 %")

    const starter = computeSellerCommission(100_000, "starter")
    expect(starter.commissionFcfa).toBe(6_500)

    const pro = computeSellerCommission(100_000, "pro")
    expect(pro.commissionFcfa).toBe(5_000)
  })

  it("abo prices match DG grid", () => {
    expect(SUBSCRIPTION_PRICES_FCFA.free).toBe(0)
    expect(SUBSCRIPTION_PRICES_FCFA.starter).toBe(7_500)
    expect(SUBSCRIPTION_PRICES_FCFA.pro).toBe(18_000)
    expect(SUBSCRIPTION_PRICES_FCFA.enterprise).toBeNull()
  })

  it("legacy computeServiceFee returns 0 buyer fee", () => {
    expect(computeServiceFee(10_000, "free").fee).toBe(0)
  })
})
