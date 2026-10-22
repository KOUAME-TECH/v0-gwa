/**
 * POST /api/orders/[id]/release
 * Libération manuelle escrow par admin OU auto 72h (appelée par Edge Function)
 * POST /api/orders/[id]/litige
 * Ouverture litige par l'acheteur
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
    const { pathname } = new URL(request.url)
    const isLitige = pathname.endsWith("/litige")

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })

    const now = new Date().toISOString()

    // ── LITIGE ────────────────────────────────────────────────────────────────
    if (isLitige) {
      if (order.buyer_id !== user.id) {
        return NextResponse.json({ error: "Seul l'acheteur peut ouvrir un litige" }, { status: 403 })
      }
      if (order.escrow_status === "released") {
        return NextResponse.json({ error: "L'escrow est déjà libéré" }, { status: 400 })
      }
      if (order.status === "litige") {
        return NextResponse.json({ error: "Litige déjà ouvert" }, { status: 400 })
      }

      const body = await request.json()
      const { description, photo_urls = [] } = body as { description: string; photo_urls?: string[] }

      if (!description || description.length < 10) {
        return NextResponse.json({ error: "Description du litige requise (min 10 caractères)" }, { status: 400 })
      }

      await supabase.from("orders").update({
        status: "litige",
        escrow_status: "disputed",
        litige_description: description,
        litige_photos: photo_urls,
        litige_opened_at: now,
        updated_at: now,
      }).eq("id", orderId)

      // Créer dispute dans la table disputes
      await supabase.from("disputes").insert({
        order_id: orderId,
        opened_by: user.id,
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
        performed_by: user.id,
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

    // ── RELEASE (admin ou auto 72h) ───────────────────────────────────────────
    // Vérifier que l'appelant est admin OU que le délai 72h est dépassé
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    const is72hPassed = order.confirmed_by_buyer_at &&
      new Date().getTime() - new Date(order.confirmed_by_buyer_at).getTime() > 72 * 60 * 60 * 1000

    if (!adminRole && !is72hPassed) {
      return NextResponse.json({
        error: "Libération possible uniquement par admin ou après 72h de confirmation de livraison"
      }, { status: 403 })
    }

    if (order.escrow_status === "released") {
      return NextResponse.json({ error: "Escrow déjà libéré", already_released: true })
    }

    await supabase.from("orders").update({
      escrow_status: "released",
      status: "livre",
      updated_at: now,
    }).eq("id", orderId)

    await supabase.from("escrow_transactions")
      .update({ status: "released", released_at: now })
      .eq("order_id", orderId)
      .in("status", ["held", "pending"])

    await supabase.from("order_audit_log").insert({
      order_id: orderId,
      action: "escrow_released",
      new_value: JSON.stringify({ triggered_by: adminRole ? "admin" : "auto_72h", amount: order.vendeur_recoit_fcfa }),
      performed_by: user.id,
    }).then(() => null)

    // Notifier vendeur
    await sendPushNotification({ externalUserIds: [order.seller_id],
      title: "Paiement libéré 🎉",
      body: `${order.vendeur_recoit_fcfa?.toLocaleString("fr-FR") ?? order.total_amount?.toLocaleString("fr-FR")} FCFA virés — commande ${order.order_number}`,
      data: { type: "payment", order_id: orderId },
    }).then(() => null)

    await sendSMSFallback(order.seller_id, supabase,
      `GWA — Paiement ${order.vendeur_recoit_fcfa?.toLocaleString("fr-FR") ?? order.total_amount?.toLocaleString("fr-FR")} FCFA libéré. Commande #${order.order_number} clôturée.`
    ).catch(() => null)

    // Recalcul SCG
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scg/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: order.seller_id }),
    }).catch(() => null)

    return NextResponse.json({ success: true, escrow_status: "released" })
  } catch (err) {
    console.error("[GWA] release/litige error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
