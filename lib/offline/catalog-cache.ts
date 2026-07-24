/**
 * Cache catalogue boutique pour lecture hors-ligne.
 * localStorage volontairement (simple, sync, pas de dépendance IDB pour le browse).
 */

const KEY = "gwa_catalog_cache_v1"
const MAX_PRODUCTS = 60
const MAX_AGE_MS = 1000 * 60 * 60 * 72 // 72 h

export type CachedCatalogProduct = {
  id: string
  name: string
  price: number
  unit: string
  description: string | null
  audio_url: string | null
  audio_lang: string | null
  created_at: string
  images: string[] | null
  origin_country: string
  origin_region: string | null
  is_organic: boolean
  is_fair_trade: boolean
  product_type: string
  category_id: string | null
  seller_id: string
  profiles: { full_name: string; avatar_url: string | null; is_verified: boolean } | null
  categories: { name: string; slug: string } | null
}

export type CachedCategory = {
  id: string
  name: string
  slug: string
  category_type: string
}

type CatalogCachePayload = {
  at: number
  products: CachedCatalogProduct[]
  categories: CachedCategory[]
}

export function saveCatalogCache(
  products: CachedCatalogProduct[],
  categories: CachedCategory[] = [],
): void {
  if (typeof localStorage === "undefined") return
  try {
    const payload: CatalogCachePayload = {
      at: Date.now(),
      products: products.slice(0, MAX_PRODUCTS),
      categories,
    }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // quota / private mode
  }
}

export function loadCatalogCache(): CatalogCachePayload | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CatalogCachePayload
    if (!parsed?.at || !Array.isArray(parsed.products)) return null
    if (Date.now() - parsed.at > MAX_AGE_MS) return null
    return {
      at: parsed.at,
      products: parsed.products,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    }
  } catch {
    return null
  }
}

export function clearCatalogCache(): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function catalogCacheAgeLabel(at: number): string {
  const mins = Math.max(1, Math.round((Date.now() - at) / 60_000))
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `il y a ${hours} h`
  return `il y a ${Math.round(hours / 24)} j`
}
