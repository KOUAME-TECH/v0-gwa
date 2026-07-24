import { describe, it, expect, beforeEach } from "vitest"
import {
  clearCatalogCache,
  loadCatalogCache,
  saveCatalogCache,
  catalogCacheAgeLabel,
} from "@/lib/offline/catalog-cache"

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    },
  })
})

describe("catalog-cache offline", () => {
  beforeEach(() => {
    clearCatalogCache()
  })

  it("sauve et recharge le catalogue", () => {
    saveCatalogCache(
      [
        {
          id: "p1",
          name: "Cacao",
          price: 1000,
          unit: "kg",
          description: null,
          audio_url: null,
          audio_lang: null,
          created_at: new Date().toISOString(),
          images: null,
          origin_country: "CI",
          origin_region: null,
          is_organic: false,
          is_fair_trade: false,
          product_type: "agriculture",
          category_id: null,
          seller_id: "s1",
          profiles: null,
          categories: null,
        },
      ],
      [{ id: "c1", name: "Cacao", slug: "cacao", category_type: "agriculture" }],
    )

    const cached = loadCatalogCache()
    expect(cached?.products).toHaveLength(1)
    expect(cached?.products[0]?.name).toBe("Cacao")
    expect(cached?.categories).toHaveLength(1)
    expect(catalogCacheAgeLabel(cached!.at)).toMatch(/il y a/)
  })

  it("retourne null si vide", () => {
    expect(loadCatalogCache()).toBeNull()
  })
})
