/**
 * Réactionsitions produit — séparées des favoris (bookmarks).
 * Heart = j'aime | ThumbsDown = je n'aime pas | Bookmark = favoris (privé).
 */

export type ProductReaction = "like" | "dislike" | null

export type ProductReactionToggleResult = {
  reaction: ProductReaction
  liked: boolean
  disliked: boolean
  likes_count: number
  dislikes_count: number
  product_id: string
}

/** Compteur affiché : jamais négatif, entier. */
export function normalizeLikesCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export const normalizeCount = normalizeLikesCount

/** Optimistic count after toggle. */
export function nextLikesCount(current: unknown, willLike: boolean): number {
  const base = normalizeLikesCount(current)
  return willLike ? base + 1 : Math.max(0, base - 1)
}

export function nextDislikesCount(current: unknown, willDislike: boolean): number {
  return nextLikesCount(current, willDislike)
}

/**
 * État optimiste après clic like ou dislike (exclusifs).
 * current = réaction actuelle de l'utilisateur.
 */
export function nextReactionState(
  current: ProductReaction,
  action: "like" | "dislike",
  likesCount: unknown,
  dislikesCount: unknown,
): {
  reaction: ProductReaction
  likes_count: number
  dislikes_count: number
} {
  let likes = normalizeCount(likesCount)
  let dislikes = normalizeCount(dislikesCount)

  if (action === "like") {
    if (current === "like") {
      return { reaction: null, likes_count: Math.max(0, likes - 1), dislikes_count: dislikes }
    }
    if (current === "dislike") dislikes = Math.max(0, dislikes - 1)
    return { reaction: "like", likes_count: likes + 1, dislikes_count: dislikes }
  }

  // dislike
  if (current === "dislike") {
    return { reaction: null, likes_count: likes, dislikes_count: Math.max(0, dislikes - 1) }
  }
  if (current === "like") likes = Math.max(0, likes - 1)
  return { reaction: "dislike", likes_count: likes, dislikes_count: dislikes + 1 }
}

/** Format compact FR pour badges marché (1.2k). */
export function formatLikesBadge(count: unknown): string {
  const n = normalizeLikesCount(count)
  if (n <= 0) return ""
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return `${Math.floor(n / 1000)}k`
}

export const formatCountBadge = formatLikesBadge

export function likeButtonLabel(liked: boolean, count: unknown): string {
  const n = normalizeLikesCount(count)
  if (liked) {
    return n > 0 ? `Je n'aime plus (${n})` : "Je n'aime plus"
  }
  return n > 0 ? `J'aime (${n})` : "J'aime"
}

export function dislikeButtonLabel(disliked: boolean, count: unknown): string {
  const n = normalizeLikesCount(count)
  if (disliked) {
    return n > 0 ? `Retirer mon dislike (${n})` : "Retirer mon dislike"
  }
  return n > 0 ? `Je n'aime pas (${n})` : "Je n'aime pas"
}

/** @deprecated alias — use ProductReactionToggleResult */
export type ProductLikeToggleResult = {
  liked: boolean
  likes_count: number
  product_id: string
}
