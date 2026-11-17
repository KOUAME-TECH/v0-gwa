/**
 * POST /api/orders/[id]/release
 * Libération manuelle escrow par admin OU auto 72h (appelée par Edge Function)
 * POST /api/orders/[id]/litige
 * Ouverture litige par l'acheteur
 */
import { type NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushNotification } from "@/lib/notifications/push"
import { releaseOrderEscrow } from "@/lib/orders/escrow-release"

function hasValidInternalToken(request: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_TOKEN || ""
  const provided = request.headers.get("x-internal-token") || ""
  if (!expected || expected.length < 16) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const { pathname } = new URL(request.url)
    const isLitige = pathname.endsWith("/litige")

    const supabase = await createClient()
    const admin = createAdminClient()
    const internal = !isLitige && hasValidInternalToken(request)
    const {
      data: { user },
    } = internal ? { data: { user: null } } : await supabase.auth.getUser()
    if (!user && !internal) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    const actorId = user?.id ?? null

    const { data: order, error: orderReadErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle()
    if (orderReadErr) {
      console.error("[GWA] release read", orderReadErr.message)
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }

    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })

    const now = new Date().toISOString()

    // ── LITIGE ────────────────────────────────────────────────────────────────
    if (isLitige) {
      if (order.buyer_id !== actorId) {
        return NextResponse.json({ error: "Seul l'acheteur peut ouvrir un litige" }, { status: 403 })
      }
      if (order.escrow_status === "released") {
        return NextResponse.json({ error: "L'escrow est déjà libéré" }, { status: 400 })
      }
      if (order.status === "disputed") {
        return NextResponse.json({ error: "Litige déjà ouvert" }, { status: 400 })
      }

      const body = await request.json()
      const { description, photo_urls = [] } = body as { description: string; photo_urls?: string[] }

      if (!description || description.length < 10) {
        return NextResponse.json({ error: "Description du litige requise (min 10 caractères)" }, { status: 400 })
      }

      if (order.payment_status !== "paid" || order.escrow_status !== "held") {
        return NextResponse.json({ error: "Litige impossible : fonds non en séquestre" }, { status: 409 })
      }

      const { error: disputeErr } = await admin.from("orders").update({
        status: "disputed",
        escrow_status: "disputed",
        litige_description: description,
        litige_photos: photo_urls,
        litige_opened_at: now,
        updated_at: now,
      }).eq("id", orderId).eq("escrow_status", "held")
      if (disputeErr) {
        console.error("[GWA] litige update", disputeErr.message)
        return NextResponse.json({ error: "Le litige n’a pas pu être enregistré." }, { status: 500 })
      }

      // Créer dispute dans la table disputes
      await supabase.from("disputes").insert({
        order_id: orderId,
        opened_by: actorId,
        reason: "quality_issue",
        description,
        evidence_urls: photo_urls,
        status: "open",
      }).then(() => null)

      // Log audit
      await supabase.from("order_audit_log").insert({
        order_id: orderId,
        action: "litige_opened",
        new_value: JSON.stringify({ description, photo_count: photo_urls.length }),
        performed_by: actorId,
      }).then(() => null)

      // Notifier vendeur
await sendPushNotification({ externalUserIds: [order.seller_id],
        title: "⚠️ Litige ouvert",
        body: `Commande ${order.order_number} : l'acheteur a ouvert un litige. Les fonds sont gelés.`,
        data: { type: "order_status", order_id: orderId },
      }).catch(() => null)

      // Notifier admins GWA (on notifie via le système de notifications)
      await supabase.from("notifications").insert({
        user_id: order.seller_id,
        type: "order_status",
        title: "Litige ouvert",
        body: `Commande ${order.order_number} — litige signalé par l'acheteur.`,
        data: { order_id: orderId, action: "litige" },
      }).then(() => null)

      return NextResponse.json({ success: true, status: "disputed" })
    }

    // ── RELEASE (admin ou auto 72h via jeton interne) ─────────────────────────
    let isAdmin = false
    if (user) {
      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()
      isAdmin = Boolean(adminRole)
    }

    const is72hPassed =
      order.confirmed_by_buyer_at &&
      Date.now() - new Date(order.confirmed_by_buyer_at).getTime() > 72 * 60 * 60 * 1000

    if (!isAdmin && !(internal && is72hPassed)) {
      return NextResponse.json(
        { error: "Libération possible uniquement par admin ou après 72h de confirmation de livraison" },
        { status: 403 },
      )
    }

    const result = await releaseOrderEscrow(order, {
      actorId,
      trigger: isAdmin ? "admin" : "auto_72h",
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    if (result.alreadyReleased) {
      return NextResponse.json({ error: "Escrow déjà libéré", already_released: true })
    }

    await sendPushNotification({
      externalUserIds: [order.seller_id],
      title: "Paiement libéré",
      body: `Commande ${order.order_number} : fonds libérés.`,
      data: { type: "payment", order_id: orderId },
    }).catch(() => null)

    return NextResponse.json({ success: true, escrow_status: "released" })
  } catch (err) {
    console.error("[GWA] release/litige error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
