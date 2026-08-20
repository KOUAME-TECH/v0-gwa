import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  getProductReactionState,
  isProductId,
  toggleProductReaction,
} from "@/lib/products/reactions"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/products/[id]/dislike — toggle je n'aime pas (retire like si présent).
 */
export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de réactions. Réessaie dans une minute." },
        { status: 429 },
      )
    }

    const { id } = await context.params
    if (!id || !isProductId(id)) {
      return NextResponse.json({ error: "Produit invalide" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const result = await toggleProductReaction(supabase, user.id, id, "dislike")
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error("[api/products/id/dislike POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    if (!id || !isProductId(id)) {
      return NextResponse.json({ error: "Produit invalide" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const result = await getProductReactionState(supabase, id, user?.id)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error("[api/products/id/dislike GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
