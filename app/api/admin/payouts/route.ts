import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_SEARCH")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }
    const gate = await requireAdminSection("finances")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const status = request.nextUrl.searchParams.get("status") || "pending"
    const allowedStatuses = new Set(["pending", "processing", "paid", "failed", "all"])
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Filtre invalide" }, { status: 400 })
    }

    let query = gate.admin
      .from("withdrawal_requests")
      .select(
        "id, user_id, amount_fcfa, phone, network, status, payout_reference, admin_notes, created_at, updated_at, processed_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(100)
    if (status !== "all") query = query.eq("status", status)

    const { data, count, error } = await query
    if (error) {
      if (/does not exist|relation/i.test(error.message)) {
        return NextResponse.json(
          { error: "Migration 053 requise (withdrawal_requests)", code: "MIGRATION_REQUIRED" },
          { status: 503 },
        )
      }
      throw error
    }

    const userIds = [...new Set((data || []).map((row) => row.user_id))]
    const { data: profiles, error: profileError } = userIds.length
      ? await gate.admin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [], error: null }
    if (profileError) throw profileError
    const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]))

    return NextResponse.json({
      payouts: (data || []).map((row) => ({
        ...row,
        seller_name: names.get(row.user_id) || "Producteur",
      })),
      total: count || 0,
    })
  } catch (err) {
    console.error("[api/admin/payouts GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
