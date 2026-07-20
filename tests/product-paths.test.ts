import { describe, it, expect } from "vitest"
import { productDetailPath, productEditPath } from "@/lib/products/paths"

describe("navigation produit (P2/P3)", () => {
  it("détail produit → /produit/:id", () => {
    expect(productDetailPath("fc72fe25-0000-4000-8000-000000000001")).toBe(
      "/produit/fc72fe25-0000-4000-8000-000000000001",
    )
  })

  it("id vide → fallback marché", () => {
    expect(productDetailPath("")).toBe("/agriculture")
    expect(productDetailPath("   ")).toBe("/agriculture")
  })

  it("édition → /dashboard/products/:id/edit", () => {
    expect(productEditPath("abc-123")).toBe("/dashboard/products/abc-123/edit")
  })
})
