<<<<<<< Updated upstream
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications/push"
import {
  mapLitigeDescriptionToReason,
  normalizeDisputeReason,
} from "@/lib/orders/escrow-flow"

type Ctx = { params: Promise<{ id: string }> }

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
    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Litige possible seulement après paiement", code: "NOT_PAID" },
        { status: 400 },
      )
    }
    if (order.status === "disputed" || order.escrow_status === "frozen") {
      return NextResponse.json({ error: "Litige déjà ouvert" }, { status: 400 })
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()
    const photos = Array.isArray(body?.photos) ? body.photos : null
    const reason = body?.reason
      ? normalizeDisputeReason(String(body.reason))
      : mapLitigeDescriptionToReason(description)

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
=======
/**
 * POST /api/orders/[id]/litige — Ouvrir un litige sur une commande
 * Body: { description: string, photo_urls?: string[] }
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendPushNotification } from "@/lib/notifications/push"
import { sendSMSFallback } from "@/lib/notifications/sms"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    // Charger la commande — seul l'acheteur peut ouvrir un litige
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (order.escrow_status === "released") {
      return NextResponse.json(
        { error: "Impossible d'ouvrir un litige : fonds déjà libérés" },
        { status: 400 }
      )
    }
    if (order.status === "litige") {
      return NextResponse.json({ error: "Un litige est déjà ouvert sur cette commande" }, { status: 400 })
    }

    const body = await request.json()
    const { description, photo_urls } = body as {
      description: string
      photo_urls?: string[]
    }

    if (!description || description.trim().length < 10) {
      return NextResponse.json(
        { error: "La description du litige doit faire au moins 10 caractères" },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Mettre à jour la commande en litige
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "litige",
        escrow_status: "disputed",
        litige_description: description.trim(),
        litige_photos: photo_urls ?? [],
        litige_opened_at: now,
        updated_at: now,
      })
      .eq("id", orderId)

    if (updateError) {
      console.error("[GWA] litige update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Insérer dans la table disputes
    try {
      await supabase.from("disputes").insert({
        order_id: orderId,
        opened_by: user.id,
        description: description.trim(),
        photo_urls: photo_urls ?? [],
        status: "open",
        created_at: now,
      })
    } catch { /* La table disputes peut ne pas exister encore */ }

    // Log d'audit
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "litige_ouvert",
        resource_type: "order",
        resource_id: orderId,
        metadata: { description: description.trim(), photo_count: photo_urls?.length ?? 0 },
        created_at: now,
      })
    } catch { /* ignore si la table n'existe pas */ }

    // Notifier le vendeur
    await sendPushNotification(order.seller_id, {
      title: "⚠️ Litige ouvert",
      body: `L'acheteur a ouvert un litige sur la commande ${order.order_number}. Vérifiez l'application.`,
      data: { type: "order_status", order_id: orderId },
    }).catch(() => null)

    await sendSMSFallback(
      order.seller_id,
      supabase,
      `GWA — Litige ouvert sur commande ${order.order_number}. Connectez-vous pour répondre.`
    ).catch(() => null)

    return NextResponse.json({ success: true, order_id: orderId })
  } catch (err) {
    console.error("[GWA] POST /api/orders/[id]/litige exception:", err)
>>>>>>> Stashed changes
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
