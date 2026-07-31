import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { canAccessSection } from "@/lib/auth/admin-permissions"
import { assertSameOrigin } from "@/lib/security/csrf"

/** GET /api/admin/subscriptions — file demandes abo */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdmin()
    if (!gate.isAdmin || !gate.admin || !gate.role) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    if (!canAccessSection(gate.role.role, "subscriptions")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const status = request.nextUrl.searchParams.get("status") || "pending"
    let query = gate.admin
      .from("subscription_requests")
      .select(
        `id, user_id, requested_tier, current_tier, amount_fcfa, status, note, created_at, updated_at,
         profile:user_id(id, full_name, phone, user_type, subscription_tier)`,
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      requests: (data || []).map((r) => ({
        ...r,
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
      })),
    })
  } catch (err) {
    console.error("[api/admin/subscriptions GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

/** POST reject — { request_id, note? } */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdmin()
    if (!gate.isAdmin || !gate.admin || !gate.role || !gate.user) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    if (!canAccessSection(gate.role.role, "subscriptions")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const requestId = String(body?.request_id || "")
    const action = String(body?.action || "reject")
    if (!requestId || action !== "reject") {
      return NextResponse.json(
        { error: "request_id + action=reject requis" },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const { error } = await gate.admin
      .from("subscription_requests")
      .update({
        status: "rejected",
        note: body?.note ? String(body.note).slice(0, 500) : null,
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("status", "pending")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[api/admin/subscriptions POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
