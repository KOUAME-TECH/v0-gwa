import { describe, expect, it } from "vitest"
import { memberShareFcfa, pousseVersusCoop, rfqNeedsCoop } from "@/lib/pricing/coop-advantage"

describe("partage de l'abonnement coopératif", () => {
  it("répartit 8 000 F sur 10 membres", () => {
    expect(memberShareFcfa(8_000, 10)).toBe(800)
    expect(memberShareFcfa(8_000, 0)).toBe(8_000)
  })
})

describe("simulateur solo vers coopérative", () => {
  it("montre 12 200 F d'économie sur 1 000 000 F de ventes", () => {
    const result = pousseVersusCoop(1_000_000, 10)
    expect(result.soloCommission).toBe(80_000)
    expect(result.soloFee).toBe(3_000)
    expect(result.soloTotal).toBe(83_000)
    expect(result.coopCommission).toBe(70_000)
    expect(result.memberShare).toBe(800)
    expect(result.coopTotal).toBe(70_800)
    expect(result.monthlyGain).toBe(12_200)
  })
})

describe("volume d'appel d'offres", () => {
  it("réserve les gros volumes à une coopérative", () => {
    expect(rfqNeedsCoop(50, 10)).toBe(true)
    expect(rfqNeedsCoop(10, 10)).toBe(false)
  })
})
