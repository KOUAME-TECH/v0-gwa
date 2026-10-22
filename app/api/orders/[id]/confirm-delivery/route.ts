/**
 * POST /api/orders/[id]/confirm-delivery
 * L'acheteur confirme la réception → libère l'escrow
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

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (!["en_transit", "paiement_escrow", "confirme", "livre"].includes(order.status)) {
      return NextResponse.json({ error: "Statut de commande incompatible" }, { status: 400 })
    }
    if (order.escrow_status === "released") {
      return NextResponse.json({ error: "Escrow déjà libéré" }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Marquer livraison confirmée
    await supabase
      .from("orders")
      .update({
        status: "livre",
        escrow_status: "released",
        confirmed_by_buyer_at: now,
        delivered_at: now,
        updated_at: now,
      })
      .eq("id", orderId)

    // Libérer toutes les escrow_transactions en attente
    await supabase
      .from("escrow_transactions")
      .update({ status: "released", released_at: now })
      .eq("order_id", orderId)
      .in("status", ["held", "pending"])

    // Mettre à jour le stock produit
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId)

    for (const item of orderItems ?? []) {
      const { data: product } = await supabase
        .from("products")
        .select("quantite_disponible_kg")
        .eq("id", item.product_id)
        .single()

      if (product?.quantite_disponible_kg !== null) {
        const newQty = Math.max(0, (product?.quantite_disponible_kg ?? 0) - item.quantity)
        await supabase
          .from("products")
          .update({ quantite_disponible_kg: newQty, updated_at: now })
          .eq("id", item.product_id)
      }
    }

    // Recalcul SCG vendeur
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scg/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: order.seller_id }),
    }).catch(() => null)

    // Notif vendeur
    await sendPushNotification({ externalUserIds: [order.seller_id],
      title: "Paiement viré ! 🎉",
      body: `${order.vendeur_recoit_fcfa?.toLocaleString("fr-FR") ?? order.total_amount.toLocaleString("fr-FR")} FCFA libérés — commande ${order.order_number}`,
      data: { type: "payment", order_id: orderId },
    }).catch(() => null)

    await sendSMSFallback(
      order.seller_id,
      supabase,
      `GWA — Paiement libéré ! Commande ${order.order_number} : ${order.vendeur_recoit_fcfa?.toLocaleString("fr-FR") ?? order.total_amount.toLocaleString("fr-FR")} FCFA.`
    ).catch(() => null)

    // Notif acheteur
    await sendPushNotification({ externalUserIds: [user.id],
      title: "Livraison confirmée ✓",
      body: `Merci ! Votre commande ${order.order_number} est clôturée.`,
      data: { type: "order_status", order_id: orderId },
    }).catch(() => null)

    return NextResponse.json({ success: true, order_id: orderId })
  } catch (err) {
    console.error("[GWA] confirm-delivery error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
