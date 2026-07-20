import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * GET /api/admin/reports — liste (RLS reports_select_own bloque le client admin)
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

    const status = request.nextUrl.searchParams.get("status") || "pending"

    let query = gate.admin
      .from("reports")
      .select(
        `
        *,
        reporter:profiles!reports_reporter_id_fkey(id, full_name, avatar_url)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const reports = (data || []).map((r) => ({
      ...r,
      reporter: Array.isArray(r.reporter) ? r.reporter[0] : r.reporter,
    }))

    return NextResponse.json({ reports })
  } catch (err) {
    console.error("[api/admin/reports]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
