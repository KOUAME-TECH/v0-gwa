import { describe, expect, it } from "vitest"
import { calculateBilling, withProvider } from "@/lib/billing/engine"
import { providerStrategy } from "@/lib/billing/providers"
import { decidePayoutWebhook } from "@/lib/billing/payout-webhook"
import type { SellerBillingInput } from "@/lib/billing/engine"

const pousse: SellerBillingInput = {
  productPrice: 10_000,
  commissionRate: 0.08,
  franchiseThreshold: 312_000,
  franchiseCap: 25_000,
  target: "producer",
  payoutIncluded: 3,
  payoutsAlreadyThisMonth: 0,
}

describe("calculateBilling", () => {
  it("aujourd'hui GeniusPay : Graine paie le virement", () => {
    const graine = withProvider(
      {
        productPrice: 10_000,
        commissionRate: 0.09,
        franchiseThreshold: 133_000,
        franchiseCap: 12_000,
        target: "producer",
        payoutIncluded: 0,
        payoutsAlreadyThisMonth: 0,
      },
      providerStrategy({
        provider: "GENIUSPAY",
        payinRate: 0.025,
        payoutFixedFee: 300,
        automationEnabled: false,
      }),
    )

    const bill = calculateBilling(graine)

    expect(bill.paymentProvider).toBe("GENIUSPAY")
    expect(bill.buyerTotal).toBe(10_250)
    expect(bill.providerPayinFee).toBe(256)
    expect(bill.commission).toBe(900)
    expect(bill.payoutPaidBySeller).toBe(300)
    expect(bill.payoutAbsorbedByGwa).toBe(0)
    expect(bill.sellerNet).toBe(8_800)
    expect(bill.gwaNetMargin).toBe(900 + 250 - 256)
  })

  it("mars 2027 PawaPay : GWA absorbe le virement", () => {
    const bill = calculateBilling(
      withProvider(
        pousse,
        providerStrategy({
          provider: "PAWAPAY",
          payinRate: 0.015,
          payoutFixedFee: 150,
          automationEnabled: true,
        }),
      ),
    )

    expect(bill.paymentProvider).toBe("PAWAPAY")
    expect(bill.buyerTotal).toBe(10_250)
    expect(bill.providerPayinFee).toBe(154)
    expect(bill.commission).toBe(800)
    expect(bill.payoutPaidBySeller).toBe(0)
    expect(bill.payoutAbsorbedByGwa).toBe(150)
    expect(bill.sellerNet).toBe(9_200)
    expect(bill.gwaNetMargin).toBe(800 + 250 - 154 - 150)
  })

  it("plafond de franchise : 500 000 F en Pousse s'arrête à 25 000 F", () => {
    const bill = calculateBilling(
      withProvider(
        {
          ...pousse,
          productPrice: 500_000,
        },
        providerStrategy({
          provider: "GENIUSPAY",
          payinRate: 0.025,
          payoutFixedFee: 300,
          automationEnabled: false,
        }),
      ),
    )

    expect(bill.franchiseApplied).toBe(true)
    expect(bill.commission).toBe(25_000)
    expect(bill.commission).toBeLessThan(Math.round(500_000 * 0.08))
  })
})

describe("decidePayoutWebhook", () => {
  it("MOCK prépare completed sans activer l'écriture", () => {
    expect(
      decidePayoutWebhook({
        provider: "MOCK",
        type: "transfer.success",
        reference: "TRX-1",
      }),
    ).toEqual({
      active: false,
      reference: "TRX-1",
      provider: "MOCK",
      nextStatus: "completed",
    })
  })

  it("un prestataire réel reste inactif", () => {
    expect(
      decidePayoutWebhook({
        provider: "PAWAPAY",
        type: "transfer.success",
        reference: "TRX-2",
      }).nextStatus,
    ).toBeNull()
  })
})
