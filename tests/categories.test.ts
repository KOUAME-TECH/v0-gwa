import { describe, it, expect } from "vitest"
import { filterBetaCategories, isBetaCategory } from "@/lib/catalog/categories"

describe("filtre catégories beta (P12 — artisanat retiré)", () => {
  const sample = [
    { id: "1", name: "Céréales", category_type: "agriculture" },
    { id: "2", name: "Cacao", category_type: "agriculture" },
    { id: "3", name: "Poterie", category_type: "artisanat" },
    { id: "4", name: "Bijoux", category_type: "artisan" },
    { id: "5", name: "Formation", category_type: "formation" },
  ]

  it("exclut artisanat et ne garde que l'agriculture", () => {
    const out = filterBetaCategories(sample)
    expect(out).toHaveLength(2)
    expect(out.map((c) => c.name)).toEqual(["Céréales", "Cacao"])
  })

  it("aucune catégorie artisanat ne survit au filtre", () => {
    const out = filterBetaCategories(sample)
    expect(out.some((c) => /artisan/i.test(c.category_type || ""))).toBe(false)
  })

  it("isBetaCategory est insensible à la casse / espaces", () => {
    expect(isBetaCategory({ category_type: " Agriculture " })).toBe(true)
    expect(isBetaCategory({ category_type: "ARTISANAT" })).toBe(false)
    expect(isBetaCategory(null)).toBe(false)
  })

  it("gère les entrées invalides", () => {
    expect(filterBetaCategories(null)).toEqual([])
    expect(filterBetaCategories(undefined)).toEqual([])
  })
})
