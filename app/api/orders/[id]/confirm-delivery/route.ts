/**
 * POST /api/orders/[id]/confirm-delivery
 * L'acheteur confirme la réception → libère l'escrow (service_role, paid + held requis).
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushNotification } from "@/lib/notifications/push"
import { evaluatePlanSwitch } from "@/lib/pricing/switch"
import { releaseOrderEscrow } from "@/lib/orders/escrow-release"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const admin = createAdminClient()
    const { data: order, error } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .maybeSingle()
    if (error) {
      console.error("[confirm-delivery] read", error.message)
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
    }
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (!["confirmed", "processing", "shipped", "delivered", "paid", "paid_preorder"].includes(order.status)) {
      return NextResponse.json({ error: "Statut de commande incompatible" }, { status: 400 })
    }

    const result = await releaseOrderEscrow(order, {
      actorId: user.id,
      trigger: "buyer",
      confirmedByBuyer: true,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    if (result.alreadyReleased) {
      return NextResponse.json({ error: "Escrow déjà libéré" }, { status: 400 })
    }

    await sendPushNotification({
      externalUserIds: [order.seller_id],
      title: "Paiement libéré",
      body: `Commande ${order.order_number} : fonds libérés.`,
      data: { type: "payment", order_id: orderId },
    }).catch(() => null)

    void evaluatePlanSwitch(order.seller_id).catch((err) => {
      console.error("[api/orders/confirm-delivery] plan switch", err)
    })

    return NextResponse.json({ success: true, order_id: orderId })
  } catch (err) {
    console.error("[GWA] confirm-delivery error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
