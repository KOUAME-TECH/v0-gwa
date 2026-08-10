import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"

const ALLOWED_TYPES = new Set(["post", "comment", "product", "user", "message"])

/**
 * POST /api/reports — signalement utilisateur
 * Body: { reported_type, reported_id, reason }
 */
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reportedType = String(body?.reported_type || "").trim().toLowerCase()
    const reportedId = String(body?.reported_id || "").trim()
    const reason = String(body?.reason || "").trim().slice(0, 1000)

    if (!ALLOWED_TYPES.has(reportedType)) {
      return NextResponse.json(
        {
          error: "reported_type invalide",
          code: "INVALID_TYPE",
          allowed: [...ALLOWED_TYPES],
        },
        { status: 400 },
      )
    }
    if (!reportedId || reportedId.length < 8) {
      return NextResponse.json(
        { error: "reported_id requis", code: "ID_REQUIRED" },
        { status: 400 },
      )
    }
    if (reason.length < 3) {
      return NextResponse.json(
        { error: "Motif trop court (min. 3 caractères)", code: "REASON_REQUIRED" },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from("reports")
      .insert({
        reporter_id: user.id,
        reported_type: reportedType,
        reported_id: reportedId,
        reason,
        status: "pending",
      })
      .select("id, status, created_at")
      .single()

    if (error) {
      console.error("[api/reports]", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, report: data })
  } catch (err) {
    console.error("[api/reports]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
