import { describe, it, expect } from "vitest"
import {
  farmerOrderStatusLabel,
  isActiveSellerOrderStatus,
  resolveFarmerNextAction,
} from "@/lib/farmer/dashboard"

describe("parcours producteur — dashboard helpers", () => {
  it("libellés commande FR", () => {
    expect(farmerOrderStatusLabel("pending")).toBe("En attente du vendeur")
    expect(farmerOrderStatusLabel("shipped")).toBe("En route")
    expect(farmerOrderStatusLabel("unknown_xyz")).toBe("unknown_xyz")
  })

  it("détecte commandes actives vendeur", () => {
    expect(isActiveSellerOrderStatus("pending")).toBe(true)
    expect(isActiveSellerOrderStatus("shipping")).toBe(true)
    expect(isActiveSellerOrderStatus("delivered")).toBe(false)
    expect(isActiveSellerOrderStatus("cancelled")).toBe(false)
  })

  it("priorise prochaine action métier", () => {
    expect(resolveFarmerNextAction({ productCount: 0, pendingOrders: 0, lowStockCount: 0 }).kind).toBe(
      "publish",
    )
    expect(
      resolveFarmerNextAction({ productCount: 2, pendingOrders: 3, lowStockCount: 1 }).kind,
    ).toBe("orders")
    expect(
      resolveFarmerNextAction({ productCount: 2, pendingOrders: 0, lowStockCount: 2 }).kind,
    ).toBe("stock")
    expect(
      resolveFarmerNextAction({
        productCount: 2,
        pendingOrders: 0,
        lowStockCount: 0,
        availableBalanceFcfa: 5000,
      }).kind,
    ).toBe("wallet")
    expect(
      resolveFarmerNextAction({
        productCount: 2,
        pendingOrders: 0,
        lowStockCount: 0,
        availableBalanceFcfa: 0,
        isVerified: false,
      }).kind,
    ).toBe("kyc")
    expect(
      resolveFarmerNextAction({
        productCount: 2,
        pendingOrders: 0,
        lowStockCount: 0,
        isVerified: true,
      }).kind,
    ).toBe("share")
  })
})
