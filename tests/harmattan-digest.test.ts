import { describe, it, expect } from "vitest"
import {
  matchesUserRegion,
  filterDigestProducts,
  digestSinceHours,
  selectDigestProducts,
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

  it("extrait la ville d'une adresse complète", () => {
    expect(
      matchesUserRegion(
        {
          id: "1",
          name: "Tomate",
          price: 100,
          unit: "kg",
          origin_region: "Abidjan",
          created_at: "",
        },
        { id: "u1", city: "Cocody, Abidjan, Côte d'Ivoire" },
      ),
    ).toBe(true)
  })

  it("match pays via alias CI", () => {
    expect(
      matchesUserRegion(
        {
          id: "1",
          name: "Tomate",
          price: 100,
          unit: "kg",
          origin_country: "Côte d'Ivoire",
          created_at: "",
        },
        { id: "u1", country: "ci" },
      ),
    ).toBe(true)
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

describe("selectDigestProducts", () => {
  it("élargit la fenêtre puis tombe sur newest si besoin", () => {
    const products = [
      {
        id: "old",
        name: "Old",
        price: 1,
        unit: "kg",
        origin_region: "Abidjan",
        created_at: "2026-02-01T10:00:00Z",
      },
      {
        id: "nogeo",
        name: "NoGeo",
        price: 1,
        unit: "kg",
        created_at: "2026-03-01T10:00:00Z",
      },
    ]
    const regional = selectDigestProducts(products, { id: "u", city: "Abidjan", country: "ci" }, 5)
    expect(regional.products.some((p) => p.id === "old")).toBe(true)
    expect(["regional_30d", "regional_7d", "newest"]).toContain(regional.mode)
    if (regional.mode === "regional_30d" || regional.mode === "newest") {
      expect(regional.isNotifiable).toBe(false)
    }

    const newest = selectDigestProducts(
      [{ id: "x", name: "X", price: 1, unit: "kg", created_at: "2026-01-01T00:00:00Z" }],
      { id: "u", city: "Dakar" },
      5,
    )
    expect(newest.mode).toBe("newest")
    expect(newest.isNotifiable).toBe(false)
    expect(newest.products).toHaveLength(1)
  })

  it("marque regional_24h comme notifiable", () => {
    const now = new Date().toISOString()
    const sel = selectDigestProducts(
      [{ id: "n", name: "N", price: 1, unit: "kg", origin_region: "Abidjan", created_at: now }],
      { id: "u", city: "Abidjan" },
      5,
    )
    expect(sel.mode).toBe("regional_24h")
    expect(sel.isNotifiable).toBe(true)
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
