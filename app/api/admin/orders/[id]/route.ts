import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

type Ctx = { params: Promise<{ id: string }> }

const ALLOWED = new Set([
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
])

/**
 * PATCH /api/admin/orders/[id]
 * Body: { status } — idempotent si déjà au statut demandé
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("orders")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const status = String(body?.status || "")

    if (!ALLOWED.has(status)) {
      return NextResponse.json(
        { error: "status invalide (confirmed|processing|shipped|delivered|cancelled)" },
        { status: 400 },
      )
    }

    const { data: existing, error: findErr } = await gate.admin
      .from("orders")
      .select("id, status, payment_status, order_number")
      .eq("id", id)
      .maybeSingle()

    if (findErr || !existing) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    }

    if (existing.status === status) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        order: existing,
      })
    }

    const { data, error } = await gate.admin
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status, payment_status, order_number")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await gate.admin.from("admin_logs").insert({
      admin_id: gate.user.id,
      action: "update_order_status",
      entity_type: "order",
      entity_id: id,
      new_data: { status, previous: existing.status },
    })

    await gate.admin.from("order_audit_log").insert({
      order_id: id,
      performed_by: gate.user.id,
      action: "status_change",
      new_value: status,
      notes: "Mise à jour par administrateur",
    })

    return NextResponse.json({ success: true, idempotent: false, order: data })
  } catch (err) {
    console.error("[api/admin/orders/id]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
