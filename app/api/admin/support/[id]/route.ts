import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * PATCH /api/admin/support/[id]
 * Body: { status, admin_notes? }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("support")
    if (!gate.isAdmin || !gate.admin || !gate.role) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const status = String(body.status || "")
    const allowed = ["open", "in_progress", "resolved", "spam"]
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      assigned_to: gate.user?.id || null,
    }
    if (typeof body.admin_notes === "string") {
      patch.admin_notes = body.admin_notes.trim() || null
    }

    const { data, error } = await gate.admin
      .from("contact_messages")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: data })
  } catch (err) {
    console.error("[api/admin/support/id]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
