import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { isAgriculturalProductType } from "@/lib/catalog/scope"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("product_type", "agriculture")
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }

    // incrément vues (best-effort)
    await supabase
      .from("products")
      .update({ views_count: (data.views_count || 0) + 1 })
      .eq("id", id)

    return NextResponse.json({ product: data })
  } catch (err) {
    console.error("[api/products/id GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from("products")
      .select("id, seller_id, product_type")
      .eq("id", id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    if (!isAgriculturalProductType(existing.product_type)) {
      return NextResponse.json({ error: "Produit hors périmètre", code: "OUT_OF_SCOPE" }, { status: 404 })
    }
    if (existing.seller_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const body = await request.json()
    if (
      body?.product_type !== undefined &&
      !isAgriculturalProductType(body.product_type)
    ) {
      return NextResponse.json(
        { error: "Seuls les produits agricoles sont autorisés", code: "OUT_OF_SCOPE" },
        { status: 400 },
      )
    }
    const allowed = [
      "name",
      "description",
      "price",
      "unit",
      "stock_quantity",
      "category_id",
      "images",
      "video_url",
      "audio_url",
      "origin_country",
      "origin_region",
      "is_organic",
      "is_fair_trade",
      "region",
      "ville",
      "status",
      "offer_status",
    ] as const

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    for (const key of allowed) {
      if (body?.[key] !== undefined) update[key] = body[key]
    }

    const { data, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ product: data })
  } catch (err) {
    console.error("[api/products/id PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from("products")
      .select("id, seller_id")
      .eq("id", id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    if (existing.seller_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Soft-delete
    const { error } = await supabase
      .from("products")
      .update({ status: "archived", offer_status: "archived" })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[api/products/id DELETE]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
