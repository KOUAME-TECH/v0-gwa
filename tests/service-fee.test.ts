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

  it("rates: Graine 9 %, Pousse 8 %, Récolte 7 %, Fédération 5 %", () => {
    expect(sellerCommissionRateForTier("free")).toBe(0.09)
    expect(sellerCommissionRateForTier("starter")).toBe(0.08)
    expect(sellerCommissionRateForTier("pro")).toBe(0.07)
    expect(sellerCommissionRateForTier("enterprise")).toBe(0.05)
  })

  it("computes seller commission on subtotal; buyer fee 0", () => {
    const free = computeSellerCommission(100_000, "free")
    expect(free.commissionFcfa).toBe(9_000)
    expect(free.vendeurRecoitFcfa).toBe(91_000)
    expect(free.buyerServiceFee).toBe(0)
    expect(free.pctLabel).toBe("9 %")

    const starter = computeSellerCommission(100_000, "starter")
    expect(starter.commissionFcfa).toBe(8_000)

    const pro = computeSellerCommission(100_000, "pro")
    expect(pro.commissionFcfa).toBe(7_000)
  })

  it("caps a large Graine basket at the franchise", () => {
    const capped = computeSellerCommission(500_000, "free")
    expect(capped.commissionFcfa).toBe(12_000)
    expect(capped.vendeurRecoitFcfa).toBe(488_000)
  })

  it("abo prices match the validated grid", () => {
    expect(SUBSCRIPTION_PRICES_FCFA.free).toBe(0)
    expect(SUBSCRIPTION_PRICES_FCFA.starter).toBe(3_000)
    expect(SUBSCRIPTION_PRICES_FCFA.pro).toBe(8_000)
    expect(SUBSCRIPTION_PRICES_FCFA.enterprise).toBeNull()
  })

  it("legacy computeServiceFee returns 0 buyer fee", () => {
    expect(computeServiceFee(10_000, "free").fee).toBe(0)
  })
})
