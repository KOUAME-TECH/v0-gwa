import { describe, it, expect } from "vitest"
import {
  matchesUserRegion,
  filterDigestProducts,
  digestSinceHours,
} from "@/lib/products/digest"
import { buildCognitiveSummary } from "@/lib/accessibility/cognitive-summary"
import { audioLangLabel, resolveUtterLang } from "@/lib/media/audio-langs"

describe("matchesUserRegion", () => {
  it("match ville utilisateur ↔ origin_region produit", () => {
    expect(
      matchesUserRegion(
        { id: "1", name: "Tomate", price: 100, unit: "kg", origin_region: "Abidjan", created_at: "" },
        { id: "u1", city: "Abidjan" },
      ),
    ).toBe(true)
  })

  it("pas de match si géo vide", () => {
    expect(
      matchesUserRegion(
        { id: "1", name: "Tomate", price: 100, unit: "kg", created_at: "" },
        { id: "u1" },
      ),
    ).toBe(false)
  })
})

describe("filterDigestProducts", () => {
  it("filtre par date et région", () => {
    const since = new Date("2026-07-19T00:00:00Z")
    const products = [
      { id: "a", name: "A", price: 1, unit: "kg", origin_region: "Dakar", created_at: "2026-07-20T10:00:00Z" },
      { id: "b", name: "B", price: 1, unit: "kg", origin_region: "Abidjan", created_at: "2026-07-18T10:00:00Z" },
    ]
    const result = filterDigestProducts(products, { id: "u", city: "Dakar" }, since)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("a")
  })
})

describe("digestSinceHours", () => {
  it("retourne une date dans le passé", () => {
    const since = digestSinceHours(24)
    expect(since.getTime()).toBeLessThan(Date.now())
  })
})

describe("buildCognitiveSummary", () => {
  it("raccourcit les longs textes", () => {
    const long = "Première phrase très importante pour comprendre. Deuxième phrase ignorée."
    expect(buildCognitiveSummary(long)?.startsWith("Première")).toBe(true)
  })
})

describe("audio-langs", () => {
  it("wolof → utter locale", () => {
    expect(resolveUtterLang("wo")).toBe("wo-SN")
    expect(audioLangLabel("wo")).toBe("Wolof")
  })
})
