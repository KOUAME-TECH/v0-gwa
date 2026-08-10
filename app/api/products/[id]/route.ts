import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizePlainText } from "@/lib/security/validation"

type Ctx = { params: Promise<{ id: string }> }

const PUBLIC_PRODUCT_SELECT =
  "id, seller_id, category_id, name, description, price, unit, stock_quantity, images, audio_url, video_url, origin_country, origin_region, is_organic, is_fair_trade, product_type, status, views_count, created_at, region, ville, offer_status, audio_lang"

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("products")
      .select(PUBLIC_PRODUCT_SELECT)
      .eq("id", id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    // Drafts / paused / archived: owner only (no public UUID leak)
    if (data.status !== "active" && data.seller_id !== user?.id) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }

    // incrément vues (best-effort, active only)
    if (data.status === "active") {
      await supabase
        .from("products")
        .update({ views_count: (data.views_count || 0) + 1 })
        .eq("id", id)
    }

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
    const { requireUser } = await import("@/lib/auth/require-admin")
    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user
    const supabase = gate.supabase

    const { data: existing } = await supabase
      .from("products")
      .select("id, seller_id, status")
      .eq("id", id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }
    if (existing.seller_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const body = await request.json()
    const allowed = [
      "name",
      "description",
      "price",
      "unit",
      "stock_quantity",
      "category_id",
      "product_type",
      "images",
      "video_url",
      "audio_url",
      "origin_country",
      "origin_region",
      "is_organic",
      "is_fair_trade",
      "region",
      "ville",
    ] as const

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    for (const key of allowed) {
      if (body?.[key] !== undefined) update[key] = body[key]
    }

    if (typeof update.name === "string") {
      update.name = sanitizePlainText(update.name, 200)
    }
    if (typeof update.description === "string") {
      update.description = sanitizePlainText(update.description, 5000)
    }
    if (update.price !== undefined) {
      const price = Number(update.price)
      update.price = Number.isFinite(price)
        ? Math.min(999_999_999, Math.max(100, Math.round(price)))
        : 100
    }
    if (update.stock_quantity !== undefined) {
      const stock = Number(update.stock_quantity)
      update.stock_quantity = Number.isFinite(stock)
        ? Math.min(999_999, Math.max(0, Math.round(stock)))
        : 0
    }

    // Statut : allowlist vendeur (pas de réactivation archive admin)
    if (typeof body?.status === "string") {
      const st = body.status
      if (st === "active" || st === "paused") {
        if (existing.status !== "archived") update.status = st
      }
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
    const { requireUser } = await import("@/lib/auth/require-admin")
    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user
    const supabase = gate.supabase

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
