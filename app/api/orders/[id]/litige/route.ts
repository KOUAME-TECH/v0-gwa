import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications/push"

type Ctx = { params: Promise<{ id: string }> }

const REASON_MAP = [
  { match: /pas reçu|non reçu|pas livré/i, reason: "product_not_received" },
  { match: /qualité|abîmé|mauvais/i, reason: "product_quality" },
  { match: /quantité|manquant/i, reason: "wrong_quantity" },
  { match: /retard/i, reason: "late_delivery" },
] as const

function mapReason(description: string): string {
  for (const r of REASON_MAP) {
    if (r.match.test(description)) return r.reason
  }
  return "other"
}

/**
 * POST /api/orders/[id]/litige
 * Ouvre un litige (acheteur ou vendeur) — admin client pour bypasse trigger.
 */
export async function POST(request: NextRequest, context: Ctx) {
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
    const description = String(body?.description || "").trim()
    if (!description) {
      return NextResponse.json({ error: "Description du litige requise" }, { status: 400 })
    }

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    }
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
    if (order.status === "disputed" || order.escrow_status === "frozen") {
      return NextResponse.json({ error: "Litige déjà ouvert" }, { status: 400 })
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()
    const photos = Array.isArray(body?.photos) ? body.photos : null
    const reason = mapReason(description)

    await admin
      .from("orders")
      .update({
        status: "disputed",
        escrow_status: "frozen",
        litige_description: description,
        litige_photos: photos,
        litige_opened_at: now,
        updated_at: now,
      })
      .eq("id", id)

    await admin
      .from("escrow_transactions")
      .update({ status: "frozen" })
      .eq("order_id", id)
      .eq("status", "held")

    const { error: disputeErr } = await admin.from("disputes").insert({
      order_id: id,
      opened_by: user.id,
      reason,
      description,
      status: "open",
      evidence_urls: photos,
    })

    if (disputeErr) {
      // Fallback si CHECK reason strict différent
      await admin.from("disputes").insert({
        order_id: id,
        opened_by: user.id,
        reason: "other",
        description,
        status: "open",
        evidence_urls: photos,
      })
    }

    await admin.from("order_audit_log").insert({
      order_id: id,
      performed_by: user.id,
      action: "litige_opened",
      new_value: "disputed",
      notes: description.slice(0, 500),
    })

    const otherId = order.buyer_id === user.id ? order.seller_id : order.buyer_id

    await admin.from("notifications").insert({
      user_id: otherId,
      type: "alert",
      title: "Litige ouvert",
      message: `Litige sur ${order.order_number}`,
      body: description.slice(0, 200),
      link: `/dashboard/commandes`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(admin as never, otherId, {
      title: "Litige GWA",
      body: `Commande ${order.order_number}`,
      url: "/dashboard/commandes",
    })

    return NextResponse.json({ success: true, status: "disputed" })
  } catch (err) {
    console.error("[api/orders/litige]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
