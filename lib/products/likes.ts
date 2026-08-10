/**
 * Product likes — séparés des favoris (bookmarks).
 * Heart = j'aime (compteur public) | Bookmark = favoris (privé).
 */

export type ProductLikeToggleResult = {
  liked: boolean
  likes_count: number
  product_id: string
}

/** Compteur affiché : jamais négatif, entier. */
export function normalizeLikesCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

/** Optimistic count after toggle. */
export function nextLikesCount(current: unknown, willLike: boolean): number {
  const base = normalizeLikesCount(current)
  return willLike ? base + 1 : Math.max(0, base - 1)
}

/** Format compact FR pour badges marché (1.2k). */
export function formatLikesBadge(count: unknown): string {
  const n = normalizeLikesCount(count)
  if (n <= 0) return ""
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return `${Math.floor(n / 1000)}k`
}

export function likeButtonLabel(liked: boolean, count: unknown): string {
  const n = normalizeLikesCount(count)
  if (liked) {
    return n > 0 ? `Je n'aime plus (${n})` : "Je n'aime plus"
  }
  return n > 0 ? `J'aime (${n})` : "J'aime"
}
