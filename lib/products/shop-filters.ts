/**
 * Boutique : filtres (prix, localisation, catégorie, note vendeur) et tri
 * (pertinence, prix croissant/décroissant, nouveautés). Fonctions pures.
 */

export type ShopSort = "relevance" | "price_asc" | "price_desc" | "newest"

export const SHOP_SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: "relevance", label: "Pertinence" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "newest", label: "Nouveautés" },
]

export type ShopProduct = {
  id: string
  name: string
  price: number
  created_at: string
  category_id: string | null
  product_type?: string | null
  ville?: string | null
  region?: string | null
  origin_region?: string | null
  seller_id: string
  feedPriority?: number
}

export type ShopFilters = {
  search: string
  type: string
  categoryId: string
  minPrice: number | null
  maxPrice: number | null
  location: string
  minRating: number
  sort: ShopSort
}

export const DEFAULT_SHOP_FILTERS: ShopFilters = {
  search: "",
  type: "all",
  categoryId: "all",
  minPrice: null,
  maxPrice: null,
  location: "all",
  minRating: 0,
  sort: "relevance",
}

export function normalizeText(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export function productLocation(p: ShopProduct): string | null {
  return p.ville || p.region || p.origin_region || null
}

/** Villes / régions disponibles, triées, sans doublon (casse et accents ignorés). */
export function locationOptions(products: ShopProduct[]): string[] {
  const seen = new Map<string, string>()
  for (const p of products) {
    const loc = productLocation(p)
    if (loc && !seen.has(normalizeText(loc))) seen.set(normalizeText(loc), loc.trim())
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"))
}

/** Note moyenne par vendeur, arrondie à 0,1, à partir des avis publics. */
export function sellerRatings(reviews: { seller_id: string | null; rating: number | null }[]): Record<string, number> {
  const acc: Record<string, { sum: number; n: number }> = {}
  for (const r of reviews) {
    if (!r.seller_id || typeof r.rating !== "number") continue
    acc[r.seller_id] ??= { sum: 0, n: 0 }
    acc[r.seller_id].sum += r.rating
    acc[r.seller_id].n += 1
  }
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(acc)) out[k] = Math.round((v.sum / v.n) * 10) / 10
  return out
}

function relevanceScore(p: ShopProduct, q: string): number {
  if (!q) return 0
  const name = normalizeText(p.name)
  if (name === q) return 3
  if (name.startsWith(q)) return 2
  return name.includes(q) ? 1 : 0
}

export function countActiveFilters(f: ShopFilters): number {
  return (
    (f.type !== "all" ? 1 : 0) +
    (f.categoryId !== "all" ? 1 : 0) +
    (f.minPrice != null || f.maxPrice != null ? 1 : 0) +
    (f.location !== "all" ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0)
  )
}

export function applyShopFilters<T extends ShopProduct>(
  products: T[],
  f: ShopFilters,
  ratings: Record<string, number> = {},
): T[] {
  const q = normalizeText(f.search)
  const loc = normalizeText(f.location)
  const list = products.filter((p) => {
    if (q && !normalizeText(p.name).includes(q)) return false
    if (f.type !== "all" && p.product_type !== f.type) return false
    if (f.categoryId !== "all" && p.category_id !== f.categoryId) return false
    if (f.minPrice != null && p.price < f.minPrice) return false
    if (f.maxPrice != null && p.price > f.maxPrice) return false
    if (f.location !== "all" && normalizeText(productLocation(p)) !== loc) return false
    if (f.minRating > 0 && (ratings[p.seller_id] ?? 0) < f.minRating) return false
    return true
  })
  const byDate = (a: T, b: T) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  switch (f.sort) {
    case "price_asc":
      return [...list].sort((a, b) => a.price - b.price || byDate(a, b))
    case "price_desc":
      return [...list].sort((a, b) => b.price - a.price || byDate(a, b))
    case "newest":
      return [...list].sort(byDate)
    default:
      // Pertinence : correspondance du nom, puis priorité d'abonnement (ordre du flux), puis nouveauté.
      return [...list].sort(
        (a, b) =>
          relevanceScore(b, q) - relevanceScore(a, q) ||
          (b.feedPriority ?? 0) - (a.feedPriority ?? 0) ||
          byDate(a, b),
      )
  }
}

/** Lien « Négocier » : conversation avec le vendeur, produit en contexte. */
export function negotiateHref(p: Pick<ShopProduct, "id" | "seller_id">): string {
  return `/messages?to=${encodeURIComponent(p.seller_id)}&product=${encodeURIComponent(p.id)}`
}
