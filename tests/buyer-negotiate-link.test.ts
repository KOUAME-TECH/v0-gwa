import { describe, expect, it } from "vitest"

/** Contrat URL CTA Négocier (fiche produit → chat offre). */
function negotiateHref(sellerId: string, productId: string) {
  const q = new URLSearchParams({
    to: sellerId,
    product: productId,
    offer: "1",
  })
  return `/messages?${q.toString()}`
}

describe("buyer negotiate deep link", () => {
  it("ouvre messages avec to + product + offer", () => {
    const href = negotiateHref("seller-1", "prod-9")
    expect(href).toContain("to=seller-1")
    expect(href).toContain("product=prod-9")
    expect(href).toContain("offer=1")
  })
})
