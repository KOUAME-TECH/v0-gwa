import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeCount,
  type ProductReaction,
  type ProductReactionToggleResult,
} from "@/lib/products/likes"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isProductId(id: string): boolean {
  return UUID_RE.test(id)
}

async function readCounts(
  supabase: SupabaseClient,
  productId: string,
): Promise<{ likes_count: number; dislikes_count: number } | null> {
  const { data } = await supabase
    .from("products")
    .select("likes_count, dislikes_count")
    .eq("id", productId)
    .maybeSingle()
  if (!data) return null
  return {
    likes_count: normalizeCount(data.likes_count),
    dislikes_count: normalizeCount(data.dislikes_count),
  }
}

async function readUserReaction(
  supabase: SupabaseClient,
  productId: string,
  userId: string,
): Promise<ProductReaction> {
  const [likeRes, dislikeRes] = await Promise.all([
    supabase
      .from("product_likes")
      .select("id")
      .eq("product_id", productId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("product_dislikes")
      .select("id")
      .eq("product_id", productId)
      .eq("user_id", userId)
      .maybeSingle(),
  ])
  if (likeRes.data?.id) return "like"
  if (dislikeRes.data?.id) return "dislike"
  return null
}

export async function getProductReactionState(
  supabase: SupabaseClient,
  productId: string,
  userId?: string | null,
): Promise<ProductReactionToggleResult | { error: string; status: number }> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, status, likes_count, dislikes_count")
    .eq("id", productId)
    .maybeSingle()

  if (error) return { error: error.message, status: 500 }
  if (!product) return { error: "Produit introuvable", status: 404 }

  const reaction = userId
    ? await readUserReaction(supabase, productId, userId)
    : null

  return {
    reaction,
    liked: reaction === "like",
    disliked: reaction === "dislike",
    likes_count: normalizeCount(product.likes_count),
    dislikes_count: normalizeCount(product.dislikes_count),
    product_id: productId,
  }
}

/**
 * Toggle like ou dislike. Exclusive : l'autre réaction est retirée (mutex SQL + API).
 */
export async function toggleProductReaction(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  action: "like" | "dislike",
): Promise<ProductReactionToggleResult | { error: string; status: number }> {
  const { data: product, error: productErr } = await supabase
    .from("products")
    .select("id, status, likes_count, dislikes_count")
    .eq("id", productId)
    .maybeSingle()

  if (productErr) return { error: productErr.message, status: 500 }
  if (!product || product.status !== "active") {
    return { error: "Produit introuvable", status: 404 }
  }

  const table = action === "like" ? "product_likes" : "product_dislikes"
  const opposite = action === "like" ? "product_dislikes" : "product_likes"

  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("product_id", productId)
    .eq("user_id", userId)
    .maybeSingle()

  let reaction: ProductReaction

  if (existing?.id) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", existing.id)
      .eq("user_id", userId)
    if (error) return { error: error.message, status: 500 }
    reaction = null
  } else {
    // Retire l'opposé côté API (le trigger mutex le fait aussi)
    await supabase
      .from(opposite)
      .delete()
      .eq("product_id", productId)
      .eq("user_id", userId)

    const { error } = await supabase.from(table).insert({
      product_id: productId,
      user_id: userId,
    })
    if (error && error.code !== "23505") {
      // Table absente → migration 064
      if (/relation|does not exist|product_likes|product_dislikes/i.test(error.message)) {
        return {
          error: "Migration 064 requise (likes/dislikes produit)",
          status: 503,
        }
      }
      return { error: error.message, status: 500 }
    }
    reaction = action
  }

  const counts = (await readCounts(supabase, productId)) ?? {
    likes_count: normalizeCount(product.likes_count),
    dislikes_count: normalizeCount(product.dislikes_count),
  }

  return {
    reaction,
    liked: reaction === "like",
    disliked: reaction === "dislike",
    likes_count: counts.likes_count,
    dislikes_count: counts.dislikes_count,
    product_id: productId,
  }
}
