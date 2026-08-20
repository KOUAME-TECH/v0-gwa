import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/reports/[id]
 * Body: { action: "resolved"|"dismissed", notes?, takedown?: boolean }
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("reports")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || "")
    const notes = body?.notes != null ? String(body.notes).slice(0, 1000) : null
    const takedown = body?.takedown === true || body?.moderation === "takedown"

    if (action !== "resolved" && action !== "dismissed") {
      return NextResponse.json(
        { error: "action requise: resolved|dismissed" },
        { status: 400 },
      )
    }

    const { data: existing, error: findErr } = await gate.admin
      .from("reports")
      .select("id, status, reported_type, reported_id")
      .eq("id", id)
      .maybeSingle()

    if (findErr || !existing) {
      return NextResponse.json({ error: "Signalement introuvable" }, { status: 404 })
    }

    if (existing.status === action && !takedown) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        report: existing,
      })
    }

    let takedownApplied: string | null = null
    if (takedown && action === "resolved" && existing.reported_id) {
      const type = String(existing.reported_type || "")
      if (type === "post") {
        const { error } = await gate.admin
          .from("posts")
          .update({ visibility: "private" })
          .eq("id", existing.reported_id)
        if (!error) takedownApplied = "post:private"
      } else if (type === "product") {
        const { error } = await gate.admin
          .from("products")
          .update({
            moderation_status: "rejected",
            status: "archived",
          })
          .eq("id", existing.reported_id)
        if (!error) takedownApplied = "product:rejected"
      } else if (type === "comment") {
        // Soft-delete best-effort (colonnes variables)
        const { error } = await gate.admin
          .from("post_comments")
          .update({ content: "[contenu retiré par modération]" })
          .eq("id", existing.reported_id)
        if (!error) takedownApplied = "comment:redacted"
      }
    }

    const { data, error } = await gate.admin
      .from("reports")
      .update({
        status: action,
        resolution_notes: notes,
        resolved_by: gate.user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, resolution_notes")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await gate.admin.from("admin_logs").insert({
      admin_id: gate.user.id,
      action: `${action}_report`,
      entity_type: "report",
      entity_id: id,
      new_data: { status: action, notes, takedown: takedownApplied },
    })

    return NextResponse.json({
      success: true,
      idempotent: false,
      report: data,
      takedown: takedownApplied,
    })
  } catch (err) {
    console.error("[api/admin/reports/id]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
