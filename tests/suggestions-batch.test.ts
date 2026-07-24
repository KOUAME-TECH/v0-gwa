import { describe, expect, it } from "vitest"
import { checkPriceAnomaly, median } from "@/lib/products/price-guard"
import { isSupportQuietHours } from "@/lib/yelly/quiet-hours"

describe("price-guard", () => {
  it("computes median", () => {
    expect(median([10, 20, 30])).toBe(20)
    expect(median([10, 20, 30, 40])).toBe(25)
  })

  it("flags anomaly low/high", () => {
    const peers = [1000, 1100, 900, 1050]
    expect(checkPriceAnomaly(100, peers).ok).toBe(false)
    expect(checkPriceAnomaly(10000, peers).ok).toBe(false)
    expect(checkPriceAnomaly(1000, peers).ok).toBe(true)
  })
})

describe("quiet hours", () => {
  it("flags night as quiet", () => {
    const night = new Date("2026-07-24T02:00:00Z")
    expect(isSupportQuietHours(night)).toBe(true)
    const day = new Date("2026-07-24T12:00:00Z")
    expect(isSupportQuietHours(day)).toBe(false)
  })
})
