import { describe, expect, it } from "vitest"
import {
  computeServiceFee,
  normalizeSubscriptionTier,
  serviceFeeRateForTier,
} from "@/lib/pricing/service-fee"

describe("service fees by subscription tier", () => {
  it("normalizes aliases", () => {
    expect(normalizeSubscriptionTier(null)).toBe("free")
    expect(normalizeSubscriptionTier("PRO")).toBe("pro")
    expect(normalizeSubscriptionTier("entreprise")).toBe("enterprise")
  })

  it("charges less as tier rises", () => {
    expect(serviceFeeRateForTier("free")).toBeGreaterThan(serviceFeeRateForTier("starter"))
    expect(serviceFeeRateForTier("starter")).toBeGreaterThan(serviceFeeRateForTier("pro"))
    expect(serviceFeeRateForTier("pro")).toBeGreaterThan(serviceFeeRateForTier("business"))
  })

  it("computes rounded FCFA fees", () => {
    const free = computeServiceFee(10_000, "free")
    expect(free.fee).toBe(250)
    expect(free.pctLabel).toBe("2.5 %")

    const pro = computeServiceFee(10_000, "pro")
    expect(pro.fee).toBe(100)
  })
})
