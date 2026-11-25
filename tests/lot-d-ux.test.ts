import { describe, expect, it, vi } from "vitest"
import {
  applyShopFilters,
  countActiveFilters,
  DEFAULT_SHOP_FILTERS,
  locationOptions,
  negotiateHref,
  sellerRatings,
  type ShopProduct,
} from "@/lib/products/shop-filters"
import { SCG_EXPLANATION, scgLevel } from "@/lib/scg/explain"
import {
  isMissingRelation,
  persistHiddenForMe,
  persistReaction,
  reactionBadge,
  splitReactions,
} from "@/lib/chat/persisted-reactions"

const P = (o: Partial<ShopProduct> & { id: string }): ShopProduct => ({
  name: "Produit",
  price: 1000,
  created_at: "2026-11-01T00:00:00Z",
  category_id: null,
  seller_id: "s1",
  ...o,
})

const products = [
  P({ id: "a", name: "Cacao grade 1", price: 3000, ville: "Daloa", seller_id: "s1", created_at: "2026-11-03T00:00:00Z", category_id: "c1" }),
  P({ id: "b", name: "Igname", price: 500, ville: "Bouaké", seller_id: "s2", created_at: "2026-11-05T00:00:00Z", category_id: "c2" }),
  P({ id: "c", name: "Cacao bio", price: 1500, region: "daloa", seller_id: "s3", created_at: "2026-11-01T00:00:00Z", category_id: "c1", feedPriority: 2 }),
  P({ id: "d", name: "Café", price: 2200, origin_region: "Man", seller_id: "s2", created_at: "2026-11-04T00:00:00Z", category_id: "c3" }),
]
const ratings = sellerRatings([
  { seller_id: "s1", rating: 5 },
  { seller_id: "s1", rating: 4 },
  { seller_id: "s2", rating: 3 },
  { seller_id: null, rating: 1 },
])

describe("Boutique — filtres et tri", () => {
  it("calcule la note moyenne par vendeur", () => {
    expect(ratings).toEqual({ s1: 4.5, s2: 3 })
  })
  it("filtre par prix min/max", () => {
    const r = applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, minPrice: 1000, maxPrice: 2500 })
    expect(r.map((p) => p.id).sort()).toEqual(["c", "d"])
  })
  it("filtre par localisation (accents et casse ignorés)", () => {
    const r = applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, location: "Daloa" })
    expect(r.map((p) => p.id).sort()).toEqual(["a", "c"])
    expect(locationOptions(products)).toEqual(["Bouaké", "Daloa", "Man"])
  })
  it("filtre par catégorie et note vendeur", () => {
    expect(applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, categoryId: "c1" }).map((p) => p.id).sort()).toEqual(["a", "c"])
    expect(applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, minRating: 4 }, ratings).map((p) => p.id)).toEqual(["a"])
  })
  it("trie par prix, nouveautés et pertinence", () => {
    expect(applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, sort: "price_asc" }).map((p) => p.id)).toEqual(["b", "c", "d", "a"])
    expect(applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, sort: "price_desc" }).map((p) => p.id)).toEqual(["a", "d", "c", "b"])
    expect(applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, sort: "newest" }).map((p) => p.id)).toEqual(["b", "d", "a", "c"])
    // « cacao » : les deux cacaos, le mieux classé (feedPriority) d'abord à score égal
    expect(applyShopFilters(products, { ...DEFAULT_SHOP_FILTERS, search: "cacao" }).map((p) => p.id)).toEqual(["c", "a"])
  })
  it("compte les filtres actifs", () => {
    expect(countActiveFilters(DEFAULT_SHOP_FILTERS)).toBe(0)
    expect(countActiveFilters({ ...DEFAULT_SHOP_FILTERS, minPrice: 1, location: "Man", minRating: 4 })).toBe(3)
  })
  it("le bouton Négocier ouvre la conversation avec le vendeur", () => {
    expect(negotiateHref({ id: "p 1", seller_id: "s1" })).toBe("/messages?to=s1&product=p%201")
  })
})

describe("Profil — Score de Confiance expliqué", () => {
  it("donne un niveau lisible", () => {
    expect(scgLevel(null)).toBeNull()
    expect(scgLevel(85)?.label).toBe("Excellent")
    expect(scgLevel(60)?.label).toBe("Bon")
    expect(scgLevel(45)?.label).toBe("En progression")
    expect(scgLevel(-5)?.label).toBe("Débutant")
    expect(SCG_EXPLANATION).toMatch(/pas une note bancaire/)
  })
})

describe("Chat — réactions et masquage persistés", () => {
  it("sépare mes réactions de celles de l'autre", () => {
    const r = splitReactions(
      [
        { message_id: "m1", user_id: "me", emoji: "👍" },
        { message_id: "m1", user_id: "peer", emoji: "❤️" },
        { message_id: "m2", user_id: "peer", emoji: "👍" },
      ],
      "me",
    )
    expect(r.own).toEqual({ m1: "👍" })
    expect(r.peer).toEqual({ m1: "❤️", m2: "👍" })
    expect(reactionBadge("👍", "👍")).toBe("👍 2")
    expect(reactionBadge("👍", "❤️")).toBe("👍❤️")
    expect(reactionBadge(undefined, undefined)).toBeNull()
  })
  it("détecte l'absence de la migration 080 (repli local)", () => {
    expect(isMissingRelation({ code: "PGRST205" })).toBe(true)
    expect(isMissingRelation({ code: "42P01" })).toBe(true)
    expect(isMissingRelation({ code: "23505" })).toBe(false)
    expect(isMissingRelation(null)).toBe(false)
  })
  it("persiste une réaction (upsert) et n'écrit rien pour un message temporaire", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ upsert }))
    const sb = { from } as never
    expect(await persistReaction(sb, "me", "tmp-1", "👍")).toBe(false)
    expect(from).not.toHaveBeenCalled()
    expect(await persistReaction(sb, "me", "m1", "👍")).toBe(true)
    expect(from).toHaveBeenCalledWith("message_reactions")
    expect(upsert).toHaveBeenCalledWith({ message_id: "m1", user_id: "me", emoji: "👍" }, { onConflict: "message_id,user_id" })
  })
  it("persiste « supprimer pour moi »", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn(() => ({ upsert }))
    expect(await persistHiddenForMe({ from } as never, "me", "m9")).toBe(true)
    expect(from).toHaveBeenCalledWith("message_hidden")
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "me", message_id: "m9" })
  })
})
