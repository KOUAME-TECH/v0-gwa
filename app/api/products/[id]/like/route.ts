import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  normalizeLikesCount,
  type ProductLikeToggleResult,
} from "@/lib/products/likes"

type Ctx = { params: Promise<{ id: string }> }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * POST /api/products/[id]/like — toggle j'aime produit.
 * Compteur maintenu par trigger gwa_sync_product_likes_count (pas de write client).
 */
export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de likes. Réessaie dans une minute." },
        { status: 429 },
      )
    }

    const { id } = await context.params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Produit invalide" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: product, error: productErr } = await supabase
      .from("products")
      .select("id, status, likes_count")
      .eq("id", id)
      .maybeSingle()

    if (productErr) {
      return NextResponse.json({ error: productErr.message }, { status: 500 })
    }
    if (!product || product.status !== "active") {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from("product_likes")
      .select("id")
      .eq("product_id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    let liked: boolean

    if (existing?.id) {
      const { error } = await supabase
        .from("product_likes")
        .delete()
        .eq("id", existing.id)
        .eq("user_id", user.id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      liked = false
    } else {
      const { error } = await supabase.from("product_likes").insert({
        product_id: id,
        user_id: user.id,
      })
      if (error) {
        // Unique race: already liked
        if (error.code === "23505") {
          liked = true
        } else {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      } else {
        liked = true
      }
    }

    const { data: refreshed } = await supabase
      .from("products")
      .select("likes_count")
      .eq("id", id)
      .maybeSingle()

    const payload: ProductLikeToggleResult = {
      liked,
      likes_count: normalizeLikesCount(
        refreshed?.likes_count ??
          (liked
            ? normalizeLikesCount(product.likes_count) + 1
            : Math.max(0, normalizeLikesCount(product.likes_count) - 1)),
      ),
      product_id: id,
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error("[api/products/id/like POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

/** GET — état like pour l'utilisateur courant + compteur. */
export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Produit invalide" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: product } = await supabase
      .from("products")
      .select("id, likes_count, status")
      .eq("id", id)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }

    let liked = false
    if (user) {
      const { data: row } = await supabase
        .from("product_likes")
        .select("id")
        .eq("product_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
      liked = !!row?.id
    }

    return NextResponse.json({
      liked,
      likes_count: normalizeLikesCount(product.likes_count),
      product_id: id,
    } satisfies ProductLikeToggleResult)
  } catch (err) {
    console.error("[api/products/id/like GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
