import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * GET /api/admin/orders — liste complète (service role ; RLS bloque le client admin)
 * Query: status, payment_status, q, page, pageSize
 */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdmin()
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const sp = request.nextUrl.searchParams
    const status = sp.get("status") || "all"
    const payment = sp.get("payment_status") || "all"
    const q = (sp.get("q") || "").trim()
    const page = Math.max(0, Number(sp.get("page") || 0))
    const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") || 20)))

    let query = gate.admin
      .from("orders")
      .select(
        `
        *,
        buyer:profiles!orders_buyer_id_fkey(id, full_name, email, avatar_url),
        seller:profiles!orders_seller_id_fkey(id, full_name, avatar_url)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (status !== "all") query = query.eq("status", status)
    if (payment !== "all") query = query.eq("payment_status", payment)
    if (q) query = query.ilike("order_number", `%${q}%`)

    const { data, count, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const orders = (data || []).map((o) => ({
      ...o,
      buyer: Array.isArray(o.buyer) ? o.buyer[0] : o.buyer,
      seller: Array.isArray(o.seller) ? o.seller[0] : o.seller,
    }))

    return NextResponse.json({ orders, total: count || 0, page, pageSize })
  } catch (err) {
    console.error("[api/admin/orders]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
