import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications/push"
import { normalizeOrderStatus } from "@/lib/orders/escrow-flow"

type Ctx = { params: Promise<{ id: string }> }

const SELLER_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: [],
  delivered: [],
  disputed: [],
  cancelled: [],
}

/**
 * PATCH /api/orders/[id]/status
 * Vendeur avance le statut (service role — bypasse trigger privilege).
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const nextStatus = normalizeOrderStatus(String(body?.status || ""))
    if (!nextStatus) {
      return NextResponse.json({ error: "status requis" }, { status: 400 })
    }

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    }
    if (order.seller_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const current = normalizeOrderStatus(order.status)
    const allowed = SELLER_TRANSITIONS[current] || []
    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Transition interdite : ${current} → ${nextStatus}`, code: "INVALID_TRANSITION" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    }
    if (nextStatus === "shipped") patch.shipped_at = now

    await admin.from("orders").update(patch).eq("id", id)
    await admin.from("order_audit_log").insert({
      order_id: id,
      performed_by: user.id,
      action: "seller_status",
      old_value: current,
      new_value: nextStatus,
    })

    await admin.from("notifications").insert({
      user_id: order.buyer_id,
      type: "order",
      title: "Commande mise à jour",
      message: `${order.order_number} → ${nextStatus}`,
      body: `${order.order_number} est maintenant « ${nextStatus} »`,
      link: `/dashboard/commandes`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(admin as never, order.buyer_id, {
      title: "Commande mise à jour",
      body: `${order.order_number}`,
      url: "/dashboard/commandes",
    })

    return NextResponse.json({ success: true, status: nextStatus })
  } catch (err) {
    console.error("[api/orders/status]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
