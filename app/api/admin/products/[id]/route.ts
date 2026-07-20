import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { productStatusAfterModeration } from "@/lib/media/compress"

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/products/[id]
 * Body: { action: "approve"|"reject", notes? } — idempotent
 *
 * Reject maps catalogue status to "paused" (CHECK allows draft|active|paused|sold_out),
 * never "rejected" — that value breaks the row update.
 */
export async function PATCH(request: NextRequest, context: Ctx) {
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

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || "")
    const notes = body?.notes != null ? String(body.notes).slice(0, 1000) : null

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action requise: approve|reject" }, { status: 400 })
    }

    const targetModeration = action === "approve" ? "approved" : "rejected"
    const targetStatus = productStatusAfterModeration(action as "approve" | "reject")

    const { data: existing, error: findErr } = await gate.admin
      .from("products")
      .select("id, moderation_status, status, name")
      .eq("id", id)
      .maybeSingle()

    if (findErr || !existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 })
    }

    if (existing.moderation_status === targetModeration) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        product: existing,
      })
    }

    const { data, error } = await gate.admin
      .from("products")
      .update({
        moderation_status: targetModeration,
        moderation_notes: notes,
        moderated_by: gate.user.id,
        moderated_at: new Date().toISOString(),
        status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, moderation_status, status, name, moderation_notes")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await gate.admin.from("admin_logs").insert({
      admin_id: gate.user.id,
      action: `${action}_product`,
      entity_type: "product",
      entity_id: id,
      new_data: { moderation_status: targetModeration, status: targetStatus, notes },
    })

    return NextResponse.json({ success: true, idempotent: false, product: data })
  } catch (err) {
    console.error("[api/admin/products/id]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
