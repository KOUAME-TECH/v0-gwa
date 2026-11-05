import { describe, expect, it } from "vitest"
import { seedPlan } from "@/lib/pricing/quote"
import { calculateOrderTotals } from "@/lib/features/payments/calculate-order"
import { ledgerIsBalanced, payInLedgerLines, payoutLedgerLines } from "@/lib/features/payments/ledger"
import { allocateStock } from "@/lib/features/agritech/handle-stock"
import { requestIsMatched } from "@/lib/features/agritech/rfq-engine"

describe("calculateOrderTotals", () => {
  it("respecte FREE, PRO et COOP_PRO, y compris la franchise", () => {
    const free = calculateOrderTotals(3_000, 10, seedPlan("FREE"))
    expect(free).toMatchObject({
      baseAmount: 30_000,
      commission: 2_400,
      buyerFee: 0,
      totalPaid: 30_000,
      sellerNet: 27_600,
      franchiseApplied: false,
    })

    const pro = calculateOrderTotals(3_000, 10, seedPlan("PRO"))
    expect(pro.commission).toBe(1_800)
    expect(pro.sellerNet).toBe(28_200)

    const proCap = calculateOrderTotals(500_001, 1, seedPlan("PRO"))
    expect(proCap.franchiseApplied).toBe(true)
    expect(proCap.commission).toBe(18_000)
    expect(proCap.sellerNet).toBe(500_001 - 18_000)

    const coop = calculateOrderTotals(1_000_001, 1, seedPlan("COOP_PRO"))
    expect(coop.franchiseApplied).toBe(true)
    expect(coop.commission).toBe(32_000)
    expect(coop.sellerNet).toBe(1_000_001 - 32_000)
  })

  it("ne met pas la commission de COOP_ENTERPRISE à zéro quand le plafond est 0", () => {
    const enterprise = calculateOrderTotals(2_000_000, 1, seedPlan("COOP_ENTERPRISE"))
    expect(enterprise.franchiseApplied).toBe(false)
    expect(enterprise.commission).toBe(80_000)
    expect(enterprise.sellerNet).toBe(1_920_000)
  })
})

describe("ledger", () => {
  it("équilibre le pay-in et le payout", () => {
    const totals = calculateOrderTotals(3_000, 10, seedPlan("FREE"))
    const payIn = payInLedgerLines({ transactionId: "order-1", totalPaid: totals.totalPaid })
    const payout = payoutLedgerLines({
      transactionId: "order-1",
      sellerNet: totals.sellerNet,
      commission: totals.commission,
      buyerFee: totals.buyerFee,
    })
    expect(ledgerIsBalanced(payIn, payout)).toBe(true)
  })
})

describe("allocateStock", () => {
  it("prend le stock physique, puis la prévente, sinon refuse", () => {
    expect(allocateStock(10, 5, 4)).toMatchObject({ ok: true, mode: "stock", stockTaken: 4 })
    expect(allocateStock(3, 20, 10)).toMatchObject({
      ok: true,
      mode: "preorder",
      stockTaken: 3,
      preorderTaken: 7,
    })
    expect(allocateStock(3, 2, 10).ok).toBe(false)
  })
})

describe("requestIsMatched", () => {
  it("passe à matched quand le volume engagé couvre la demande", () => {
    expect(requestIsMatched(100, [40, 60])).toBe(true)
    expect(requestIsMatched(100, [40, 50])).toBe(false)
  })
})
