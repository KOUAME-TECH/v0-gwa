import { describe, expect, it } from "vitest"
import {
  orderCountsTowardWalletBalance,
  orderNetToSellerFcfa,
  sumWalletAvailableFcfa,
} from "@/lib/wallet/balance"
import { effectiveSubscriptionTier } from "@/lib/pricing/effective-tier"
import { assertSameOrigin } from "@/lib/security/csrf"

describe("wallet balance anti double cash-out", () => {
  it("exclut les commandes déjà payout paid", () => {
    expect(
      orderCountsTowardWalletBalance({
        payment_status: "paid",
        escrow_status: "released",
        payout_status: "paid",
      }),
    ).toBe(false)
  })

  it("inclut credited_wallet (litige release)", () => {
    expect(
      orderCountsTowardWalletBalance({
        payment_status: "paid",
        escrow_status: "released",
        payout_status: "credited_wallet",
      }),
    ).toBe(true)
  })

  it("calcule net − retraits", () => {
    const { available, gross } = sumWalletAvailableFcfa(
      [
        {
          payment_status: "paid",
          escrow_status: "released",
          payout_status: "credited_wallet",
          vendeur_recoit_fcfa: 9000,
        },
        {
          payment_status: "paid",
          escrow_status: "released",
          payout_status: "paid",
          vendeur_recoit_fcfa: 5000,
        },
      ],
      1000,
    )
    expect(gross).toBe(9000)
    expect(available).toBe(8000)
    expect(orderNetToSellerFcfa({ total_amount: 10000, commission_fcfa: 800 })).toBe(
      9200,
    )
  })
})

describe("effective subscription tier", () => {
  it("downgrade free si expiré", () => {
    expect(
      effectiveSubscriptionTier("pro", "2020-01-01T00:00:00.000Z"),
    ).toBe("free")
    expect(
      effectiveSubscriptionTier("starter", "2099-01-01T00:00:00.000Z"),
    ).toBe("starter")
  })
})

describe("CSRF Bearer court-circuit restreint", () => {
  it("refuse Bearer court forgeable", () => {
    const req = new Request("https://gwa.test/api/x", {
      method: "POST",
      headers: {
        authorization: "Bearer x",
        host: "gwa.test",
        origin: "https://evil.example",
      },
    })
    const res = assertSameOrigin(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })
})
