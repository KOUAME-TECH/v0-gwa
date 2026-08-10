/**
 * POST /api/products/[id]/favorite — Toggle favori
 * Ajoute ou retire le produit des favoris de l'utilisateur connecté.
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    // Vérifier si le favori existe déjà
    const { data: existing } = await supabase
      .from("product_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .maybeSingle()

    let is_favorite: boolean

    if (existing) {
      // Supprimer le favori
      await supabase
        .from("product_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId)

      // Décrémenter favoris_count — fallback manuel si la RPC n'existe pas
      const { error: rpcErr } = await supabase.rpc("decrement_favoris_count", { product_id: productId })
      if (rpcErr) {
        const { data: prod } = await supabase
          .from("products")
          .select("favoris_count")
          .eq("id", productId)
          .single()
        if (prod) {
          await supabase
            .from("products")
            .update({ favoris_count: Math.max(0, (prod.favoris_count ?? 1) - 1) })
            .eq("id", productId)
        }
      }
      is_favorite = false
    } else {
      // Ajouter le favori
      await supabase
        .from("product_favorites")
        .insert({ user_id: user.id, product_id: productId })

      // Incrémenter favoris_count
      const { error: rpcErr } = await supabase.rpc("increment_favoris_count", { product_id: productId })
      if (rpcErr) {
        const { data: prod } = await supabase
          .from("products")
          .select("favoris_count")
          .eq("id", productId)
          .single()
        if (prod) {
          await supabase
            .from("products")
            .update({ favoris_count: (prod.favoris_count ?? 0) + 1 })
            .eq("id", productId)
        }
      }
      is_favorite = true
    }

    // Lire le count actuel
    const { data: product } = await supabase
      .from("products")
      .select("favoris_count")
      .eq("id", productId)
      .single()

    return NextResponse.json({
      is_favorite,
      count: product?.favoris_count ?? 0,
    })
  } catch (err) {
    console.error("[GWA] POST /api/products/[id]/favorite exception:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
