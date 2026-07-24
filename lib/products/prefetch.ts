/**
 * Cache produit court TTL — navigation Acheter instantanée (session).
 */
const KEY = "gwa_product_prefetch_v1"
const MAX = 24
const TTL_MS = 1000 * 60 * 15 // 15 min

type Entry = { at: number; product: Record<string, unknown> }

function readAll(): Record<string, Entry> {
  if (typeof sessionStorage === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, Entry>
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, Entry>) {
  if (typeof sessionStorage === "undefined") return
  try {
    const ids = Object.keys(map)
    if (ids.length > MAX) {
      const sorted = ids.sort((a, b) => (map[a].at || 0) - (map[b].at || 0))
      for (const id of sorted.slice(0, ids.length - MAX)) delete map[id]
    }
    sessionStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

export function cacheProductPreview(product: { id: string } & Record<string, unknown>) {
  if (!product?.id) return
  const map = readAll()
  map[product.id] = { at: Date.now(), product }
  writeAll(map)
}

export function readProductPreview<T = Record<string, unknown>>(id: string): T | null {
  const map = readAll()
  const row = map[id]
  if (!row?.product) return null
  if (Date.now() - row.at > TTL_MS) {
    delete map[id]
    writeAll(map)
    return null
  }
  return row.product as T
}

/** Prefetch route RSC + hydrate cache from feed/marketplace card data. */
export function prefetchProduct(
  router: { prefetch: (href: string) => void },
  product: { id: string } & Record<string, unknown>,
) {
  if (!product?.id) return
  cacheProductPreview(product)
  try {
    router.prefetch(`/produit/${product.id}`)
  } catch {
    /* ignore */
  }
}
