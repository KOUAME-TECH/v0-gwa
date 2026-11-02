import { describe, it, expect } from "vitest"
import { productShareUrl, shopShareText } from "@/lib/farmer/share"

describe("farmer share helpers", () => {
  it("construit URL produit", () => {
    expect(productShareUrl("abc", "https://mygwa.org")).toBe(
      "https://mygwa.org/produit/abc",
    )
  })

  it("texte boutique FR", () => {
    expect(shopShareText({ sellerName: "Awa", productCount: 2 })).toContain("2 annonces")
    expect(shopShareText({ sellerName: "Awa", productCount: 1 })).toContain("1 annonce")
  })
})
