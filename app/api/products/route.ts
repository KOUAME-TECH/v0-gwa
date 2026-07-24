import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizeForQuery, sanitizePlainText } from "@/lib/security/validation"

/**
 * GET /api/products — catalogue public (filtres)
 * POST /api/products — créer une offre (auth)
 */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_SEARCH")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const { searchParams } = request.nextUrl
    const q = searchParams.get("q")?.trim()
    const categoryId = searchParams.get("category_id")
    const sellerId = searchParams.get("seller_id")
    const productType = searchParams.get("product_type") || "agriculture"
    const statusParam = searchParams.get("status")
    // Public catalogue: force active unless seller_id=self (handled below)
    const status = statusParam === "all" ? null : statusParam || "active"
    const limit = Math.min(Number(searchParams.get("limit") || 24), 100)
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0)
    const createdSince = searchParams.get("created_since")?.trim()
    const regionFilter = searchParams.get("region")?.trim()
    const villeFilter = searchParams.get("ville")?.trim()

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let query = supabase
      .from("products")
      .select(
        "id, seller_id, category_id, name, description, price, unit, stock_quantity, images, audio_url, origin_country, origin_region, is_organic, product_type, status, views_count, created_at, region, ville, offer_status, audio_lang",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Seul le vendeur peut lister ses propres non-actifs
    if (sellerId && user?.id === sellerId) {
      if (status) query = query.eq("status", status)
    } else {
      query = query.eq("status", "active")
    }

    if (productType !== "all") query = query.eq("product_type", productType)
    if (categoryId) query = query.eq("category_id", categoryId)
    if (sellerId) query = query.eq("seller_id", sellerId)
    if (q) {
      const safe = sanitizeForQuery(q)
      if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`)
    }
    if (createdSince) {
      const parsed = new Date(createdSince)
      if (!Number.isNaN(parsed.getTime())) {
        query = query.gte("created_at", parsed.toISOString())
      }
    }
    if (regionFilter) {
      const safe = sanitizeForQuery(regionFilter)
      if (safe) query = query.ilike("origin_region", `%${safe}%`)
    }
    if (villeFilter) {
      const safe = sanitizeForQuery(villeFilter)
      if (safe) query = query.ilike("ville", `%${safe}%`)
    }

    const { data, error, count } = await query
    if (error) {
      console.error("[api/products GET]", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      products: data ?? [],
      count: count ?? 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error("[api/products GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de créations" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const name = sanitizePlainText(String(body?.name || ""), 100)
    const price = Number(body?.price)
    const categoryId = body?.category_id || null

    if (!name || name.length < 3 || !Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: "Nom et prix valides requis" },
        { status: 400 },
      )
    }

    const payload = {
      seller_id: user.id,
      name,
      description: body?.description
        ? sanitizePlainText(String(body.description), 2000)
        : null,
      price: Math.min(Math.max(Math.floor(price), 0), 999_999_999),
      unit: body?.unit ? sanitizePlainText(String(body.unit), 20) : "kg",
      stock_quantity: Math.min(Math.max(Number(body?.stock_quantity) || 0, 0), 999_999),
      category_id: categoryId,
      product_type: body?.product_type || "agriculture",
      images: Array.isArray(body?.images) ? body.images : null,
      video_url: body?.video_url ? String(body.video_url).slice(0, 500) : null,
      audio_url: body?.audio_url ? String(body.audio_url).slice(0, 500) : null,
      origin_country: body?.origin_country
        ? sanitizePlainText(String(body.origin_country), 80)
        : null,
      origin_region: body?.origin_region
        ? sanitizePlainText(String(body.origin_region), 80)
        : null,
      is_organic: !!body?.is_organic,
      is_fair_trade: !!body?.is_fair_trade,
      region: body?.region ? sanitizePlainText(String(body.region), 80) : null,
      ville: body?.ville ? sanitizePlainText(String(body.ville), 80) : null,
      audio_lang: body?.audio_lang ? String(body.audio_lang).slice(0, 8) : "fr",
      // Statut imposé serveur — ignore body.status (anti-escalade)
      status: "active",
      offer_status: "active",
    }

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error("[api/products POST]", error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ product: data }, { status: 201 })
  } catch (err) {
    console.error("[api/products POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
