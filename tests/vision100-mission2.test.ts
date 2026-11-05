import { describe, expect, it } from "vitest"
import { seedPlan } from "@/lib/pricing/quote"
import { calculateOrderTotals } from "@/lib/features/payments/calculate-order"
import { ledgerIsBalanced, payInLedgerLines, payoutLedgerLines } from "@/lib/features/payments/ledger"
import { payoutFeeFcfa, sellerReceivesAfterPayoutFee } from "@/lib/features/payments/payout-fee"
import { allocateStock } from "@/lib/features/agritech/handle-stock"
import { requestIsMatched } from "@/lib/features/agritech/rfq-engine"

const buyerFee = { buyer_service_fee_fixed: 250 }

describe("six plans du 5 novembre", () => {
  it("calcule commission, frais acheteur et net sans taux en dur", () => {
    const graine = calculateOrderTotals(3_000, 10, seedPlan("FREE"), buyerFee)
    expect(graine).toMatchObject({
      baseAmount: 30_000,
      commission: 2_700,
      buyerFee: 250,
      totalPaid: 30_250,
      sellerNet: 27_300,
      franchiseApplied: false,
    })
    expect(calculateOrderTotals(3_000, 10, seedPlan("STARTER"), buyerFee).commission).toBe(2_400)
    expect(calculateOrderTotals(3_000, 10, seedPlan("PRO"), buyerFee).commission).toBe(2_100)
    expect(calculateOrderTotals(3_000, 10, seedPlan("COOP_START"), buyerFee).commission).toBe(2_100)
    expect(calculateOrderTotals(3_000, 10, seedPlan("COOP_PRO"), buyerFee).commission).toBe(1_800)

    const recolte = calculateOrderTotals(642_001, 1, seedPlan("PRO"), buyerFee)
    expect(recolte.franchiseApplied).toBe(true)
    expect(recolte.commission).toBe(45_000)

    const federation = calculateOrderTotals(2_000_000, 1, seedPlan("COOP_ENTERPRISE"), buyerFee)
    expect(federation.franchiseApplied).toBe(false)
    expect(federation.commission).toBe(100_000)
    expect(federation.buyerFee).toBe(250)
  })

  it("ajoute 2 % du surplus au plafond des plans coopératifs", () => {
    const union = calculateOrderTotals(1_500_000, 1, seedPlan("COOP_PRO"), {
      franchise_surplus_rate: 0.02,
    })
    expect(union.franchiseApplied).toBe(true)
    expect(union.commission).toBe(70_000)
    expect(union.sellerNet).toBe(1_430_000)

    const recolte = calculateOrderTotals(642_001, 1, seedPlan("PRO"), {
      franchise_surplus_rate: 0.02,
    })
    expect(recolte.commission).toBe(45_000)
  })
})

describe("frais de versement", () => {
  it("retient le montant lu en base dès que le quota du mois est atteint", () => {
    expect(payoutFeeFcfa({ payoutsAlreadyThisMonth: 0, payoutIncluded: 0, feeCost: 300 })).toBe(300)
    expect(payoutFeeFcfa({ payoutsAlreadyThisMonth: 2, payoutIncluded: 3, feeCost: 300 })).toBe(0)
    expect(payoutFeeFcfa({ payoutsAlreadyThisMonth: 3, payoutIncluded: 3, feeCost: 300 })).toBe(300)
    expect(payoutFeeFcfa({ payoutsAlreadyThisMonth: 2, payoutIncluded: 99, feeCost: 400 })).toBe(0)
    expect(sellerReceivesAfterPayoutFee(27_300, 300)).toBe(27_000)
  })
})

describe("grand livre", () => {
  it("équilibre le paiement et le versement, frais de versement compris", () => {
    const totals = calculateOrderTotals(3_000, 10, seedPlan("FREE"), buyerFee)
    const fee = payoutFeeFcfa({ payoutsAlreadyThisMonth: 0, payoutIncluded: 0, feeCost: 300 })
    const sellerNet = sellerReceivesAfterPayoutFee(totals.sellerNet, fee)
    const payIn = payInLedgerLines({ transactionId: "order-1", totalPaid: totals.totalPaid })
    const payout = payoutLedgerLines({
      transactionId: "order-1",
      sellerNet,
      commission: totals.commission,
      buyerFee: totals.buyerFee,
      payoutFee: fee,
    })
    expect(ledgerIsBalanced(payIn, payout)).toBe(true)
    expect(payIn[0]?.amount).toBe(30_250)
    expect(payout.reduce((sum, line) => sum + line.amount, 0)).toBe(30_250)
  })
})

describe("prévente", () => {
  it("prend le stock physique puis la récolte estimée", () => {
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

describe("agrégation", () => {
  it("passe à matched quand trois producteurs couvrent le volume", () => {
    expect(requestIsMatched(50, [20, 15, 15])).toBe(true)
    expect(requestIsMatched(50, [20, 15, 10])).toBe(false)
  })
})
