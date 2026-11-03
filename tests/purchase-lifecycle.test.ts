import { describe, expect, it } from "vitest"
import { deriveLifecycle } from "@/lib/orders/lifecycle"
import {
  insufficientStockMessage,
  selfPurchaseMessage,
} from "@/lib/orders/purchase-guards"

describe("auto-achat", () => {
  it("explique au producteur d'utiliser un compte acheteur", () => {
    expect(selfPurchaseMessage("producteur")).toMatch(/compte acheteur/i)
    expect(selfPurchaseMessage("producteur")).not.toMatch(/Impossible de commander chez soi/)
  })

  it("explique aussi le cas d'un compte qui vend et achète", () => {
    expect(selfPurchaseMessage("acheteur")).toMatch(/compte acheteur distinct/i)
  })
})

describe("stock", () => {
  it("dit combien il reste", () => {
    expect(insufficientStockMessage("Cacao", 2)).toMatch(/Il reste 2/)
    expect(insufficientStockMessage("Cacao", 0)).toMatch(/plus disponible/)
  })
})

describe("cycle de vie", () => {
  it("passe de l'attente au paiement puis à la réception confirmée", () => {
    expect(deriveLifecycle({ status: "pending", payment_status: "pending" })).toBe("pending")
    expect(
      deriveLifecycle({ status: "pending", payment_status: "paid", escrow_status: "held" }),
    ).toBe("paid")
    expect(deriveLifecycle({ status: "processing", payment_status: "paid" })).toBe("processing")
    expect(deriveLifecycle({ status: "shipped", payment_status: "paid" })).toBe("shipped")
    expect(
      deriveLifecycle({
        status: "delivered",
        payment_status: "paid",
        escrow_status: "released",
        confirmed_by_buyer_at: "2026-11-03T00:00:00Z",
      }),
    ).toBe("completed")
    expect(deriveLifecycle({ status: "cancelled" })).toBe("cancelled")
    expect(deriveLifecycle({ status: "disputed" })).toBe("disputed")
  })
})
