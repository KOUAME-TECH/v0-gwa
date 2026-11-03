import { describe, expect, it } from "vitest"
import { parseLitigeBody } from "@/lib/orders/litige-schema"

describe("parseLitigeBody", () => {
  it("accepte description valide", () => {
    const r = parseLitigeBody({
      description: "Produit non reçu après 5 jours",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.reason).toBe("product_not_received")
    }
  })

  it("refuse description trop courte", () => {
    const r = parseLitigeBody({ description: "court" })
    expect(r.ok).toBe(false)
  })

  it("sanitise HTML", () => {
    const r = parseLitigeBody({
      description: "<b>Qualité mauvaise</b> et moisissure",
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.description).not.toMatch(/</)
      expect(r.data.reason).toBe("quality_issue")
    }
  })
})
