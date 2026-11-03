import { describe, expect, it } from "vitest"
import { orderCreateSchema } from "@/lib/orders/create-schema"

describe("orderCreateSchema", () => {
  const valid = {
    seller_id: "11111111-1111-4111-8111-111111111111",
    payment_method: "geniuspay",
    shipping_address: "Cocody",
    shipping_city: "Abidjan",
    shipping_country: "ci",
    shipping_phone: "+22507000000",
    items: [
      {
        product_id: "22222222-2222-4222-8222-222222222222",
        quantity: 2,
      },
    ],
  }

  it("accepte une commande valide", () => {
    const r = orderCreateSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it("refuse seller_id non uuid", () => {
    const r = orderCreateSchema.safeParse({ ...valid, seller_id: "x" })
    expect(r.success).toBe(false)
  })

  it("refuse items vides", () => {
    const r = orderCreateSchema.safeParse({ ...valid, items: [] })
    expect(r.success).toBe(false)
  })

  it("sanitise HTML dans l’adresse", () => {
    const r = orderCreateSchema.safeParse({
      ...valid,
      shipping_address: "<script>alert(1)</script>Rue A",
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.shipping_address).not.toMatch(/script/i)
      expect(r.data.shipping_address).toContain("Rue A")
    }
  })
})
