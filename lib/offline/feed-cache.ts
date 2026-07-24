/**
 * Cache feed (produits + posts) pour lecture hors-ligne.
 */
const KEY = "gwa_feed_cache_v1"
const MAX_ITEMS = 40
const MAX_AGE_MS = 1000 * 60 * 60 * 72 // 72 h

export type CachedFeedItem = {
  type: "product" | "post"
  data: Record<string, unknown>
  isLiked?: boolean
  isSaved?: boolean
}

type FeedCachePayload = {
  at: number
  items: CachedFeedItem[]
}

export function saveFeedCache(items: CachedFeedItem[]): void {
  if (typeof localStorage === "undefined") return
  try {
    const payload: FeedCachePayload = {
      at: Date.now(),
      items: items.slice(0, MAX_ITEMS),
    }
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

export function loadFeedCache(): FeedCachePayload | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FeedCachePayload
    if (!parsed?.at || !Array.isArray(parsed.items)) return null
    if (Date.now() - parsed.at > MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function feedCacheAgeLabel(at: number): string {
  const mins = Math.max(1, Math.round((Date.now() - at) / 60_000))
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `il y a ${hours} h`
  return `il y a ${Math.round(hours / 24)} j`
}
