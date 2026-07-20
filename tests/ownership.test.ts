import { describe, it, expect } from "vitest"
import {
  canModifyProduct,
  softDeleteProductPatch,
  isArchived,
} from "@/lib/products/ownership"

describe("propriété + soft-delete produit (P7)", () => {
  it("le vendeur propriétaire peut modifier/supprimer", () => {
    expect(canModifyProduct({ seller_id: "u1" }, "u1")).toBe(true)
  })

  it("un autre utilisateur ne peut pas", () => {
    expect(canModifyProduct({ seller_id: "u1" }, "u2")).toBe(false)
  })

  it("données manquantes → refus", () => {
    expect(canModifyProduct(null, "u1")).toBe(false)
    expect(canModifyProduct({ seller_id: "u1" }, null)).toBe(false)
    expect(canModifyProduct({ seller_id: null }, "u1")).toBe(false)
  })

  it("soft-delete met le statut à archived", () => {
    const patch = softDeleteProductPatch()
    expect(patch.status).toBe("archived")
    expect(patch.offer_status).toBe("archived")
    expect(isArchived({ status: "archived" })).toBe(true)
    expect(isArchived({ status: "active" })).toBe(false)
  })
})
