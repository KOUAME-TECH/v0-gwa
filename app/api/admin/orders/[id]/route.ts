import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { ORDER_LIFECYCLE, isOrderLifecycle } from "@/lib/orders/lifecycle"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  const gate = await requireAdminSection("orders")
  if (!gate.isAdmin || !gate.admin) {
    return NextResponse.json(
      { error: gate.error || "Accès refusé" },
      { status: gate.user ? 403 : 401 },
    )
  }
  const { id } = await context.params
  const [{ data: order, error }, { data: history }] = await Promise.all([
    gate.admin.from("orders").select("id, order_number, status, lifecycle_status, payment_status, escrow_status, total_amount, commission_fcfa, vendeur_recoit_fcfa, created_at").eq("id", id).maybeSingle(),
    gate.admin.from("order_status_history").select("id, from_status, to_status, actor_id, reason, created_at").eq("order_id", id).order("created_at", { ascending: true }),
  ])
  if (error || !order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
  }
  return NextResponse.json({ order, history: history || [] })
}

const ALLOWED = new Set<string>(ORDER_LIFECYCLE)

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
    const refund = body?.refund === true
    const noteOnly = body?.noteOnly === true
    const status = refund ? "cancelled" : String(body?.status || "")
    const reason = String(body?.reason || body?.note || "").slice(0, 500)

    if (noteOnly && !reason) {
      return NextResponse.json({ error: "La note est vide." }, { status: 400 })
    }

    if (!refund && !noteOnly && !isOrderLifecycle(status)) {
      return NextResponse.json(
        { error: "Statut inconnu.", allowed: [...ALLOWED] },
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

    if (!refund && !noteOnly && existing.status === status) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        order: existing,
      })
    }

    if (noteOnly) {
      const { error: noteError } = await gate.admin.from("order_status_history").insert({
        order_id: id,
        from_status: existing.status,
        to_status: existing.status,
        actor_id: gate.user?.id,
        reason,
      })
      if (noteError) {
        return NextResponse.json({ error: noteError.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, note: true })
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      status_change_reason: reason || (refund ? "Remboursement admin" : "Mise à jour admin"),
      status_changed_by: gate.user?.id,
    }
    if (refund) patch.payment_status = "refunded"
    if (status === "paid") patch.payment_status = "paid"
    if (status === "completed") patch.confirmed_by_buyer_at = new Date().toISOString()

    const { data, error } = await gate.admin
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("id, status, payment_status, lifecycle_status, order_number")
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
