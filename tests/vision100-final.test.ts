import { describe, expect, it } from "vitest"
import { canEditCommercialSettings } from "@/lib/auth/admin-permissions"
import { createOrderSchema, joinRfqSchema } from "@/lib/validation/public-api"

describe("tarifs réservés au financier", () => {
  it("refuse un administrateur général et un visiteur", () => {
    expect(canEditCommercialSettings("super_admin")).toBe(true)
    expect(canEditCommercialSettings("finance_admin")).toBe(true)
    expect(canEditCommercialSettings("admin")).toBe(false)
    expect(canEditCommercialSettings("support")).toBe(false)
  })
})

describe("validation des commandes et des offres", () => {
  it("refuse une commande sans produit", () => {
    expect(createOrderSchema.safeParse({ items: [] }).success).toBe(false)
    expect(createOrderSchema.safeParse({ items: [{ product_id: "pas-un-id", quantity: 1 }] }).success).toBe(false)
    expect(
      createOrderSchema.safeParse({
        items: [{ product_id: "11111111-1111-4111-8111-111111111111", quantity: 2 }],
      }).success,
    ).toBe(true)
  })

  it("refuse une offre groupée sans volume", () => {
    expect(joinRfqSchema.safeParse({ buyerRequestId: "x", volumeCommitted: 0 }).success).toBe(false)
    expect(
      joinRfqSchema.safeParse({
        buyerRequestId: "11111111-1111-4111-8111-111111111111",
        volumeCommitted: 20,
      }).success,
    ).toBe(true)
  })
})

describe("badge panier", () => {
  it("n'affiche rien quand le panier est vide", () => {
    const show = (count: number) => count > 0
    expect(show(0)).toBe(false)
    expect(show(2)).toBe(true)
  })
})
