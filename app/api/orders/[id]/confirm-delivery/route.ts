/**
 * POST /api/orders/[id]/confirm-delivery
 * Aligné sur /confirm : l'acheteur confirme la réception (action confirm),
 * pose confirmed_by_buyer_at, laisse le séquestre held et met payout pending_ops.
 * Statuts admis : ceux du CHECK prod, hors draft/pending/cancelled/disputed/completed.
 */
import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { sendPushNotification } from "@/lib/notifications/push"
import { sendSMSFallback } from "@/lib/notifications/sms"
import { evaluatePlanSwitch } from "@/lib/pricing/switch"
import {
  prepareReleaseSplit,
  recordReleaseSplitOnce,
  releaseEscrowGate,
  releaseLedgerHttp,
} from "@/lib/features/payments/ledger"

const CONFIRMABLE = new Set([
  "paid",
  "paid_preorder",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (!CONFIRMABLE.has(order.status)) {
      return NextResponse.json({ error: "Statut de commande incompatible" }, { status: 400 })
    }
    if (order.escrow_status === "released") {
      return NextResponse.json({ error: "Escrow déjà libéré" }, { status: 400 })
    }
    if (order.confirmed_by_buyer_at) {
      return NextResponse.json({ error: "Réception déjà confirmée" }, { status: 400 })
    }
    const gate = releaseEscrowGate(order)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status })
    }

    const now = new Date().toISOString()
    const admin = createAdminClient()
    const prepared = prepareReleaseSplit(order)
    if (!prepared.ok) {
      const http = releaseLedgerHttp(prepared)
      return NextResponse.json(http.body, { status: http.status })
    }

    const ledger = await recordReleaseSplitOnce(admin as never, {
      ...prepared.split,
      action: "confirm",
      nextEscrow: "held",
      nextStatus: "delivered",
      confirmedAt: now,
      payoutStatus: "pending_ops",
      payoutAt: null,
    })
    if (!ledger.ok) {
      const http = releaseLedgerHttp(ledger)
      return NextResponse.json(http.body, { status: http.status })
    }

    const { data: orderItems } = await admin
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId)

    for (const item of orderItems ?? []) {
      const { data: product } = await admin
        .from("products")
        .select("quantite_disponible_kg")
        .eq("id", item.product_id)
        .single()

      if (product?.quantite_disponible_kg !== null && product?.quantite_disponible_kg !== undefined) {
        const newQty = Math.max(0, (product?.quantite_disponible_kg ?? 0) - item.quantity)
        await admin
          .from("products")
          .update({ quantite_disponible_kg: newQty, updated_at: now })
          .eq("id", item.product_id)
      }
    }

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scg/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: order.seller_id }),
    }).catch(() => null)

    await sendPushNotification({
      externalUserIds: [order.seller_id],
      title: "Livraison confirmée",
      body: `Commande ${order.order_number} confirmée par l'acheteur — versement en attente.`,
      data: { type: "order_status", order_id: orderId },
    }).catch(() => null)

    await sendSMSFallback(
      order.seller_id,
      supabase,
      `GWA — Livraison confirmée, commande ${order.order_number}. Le versement sera traité par les opérations.`,
    ).catch(() => null)

    await sendPushNotification({
      externalUserIds: [user.id],
      title: "Livraison confirmée ✓",
      body: `Merci ! Votre commande ${order.order_number} est confirmée.`,
      data: { type: "order_status", order_id: orderId },
    }).catch(() => null)

    if (order.seller_id) {
      void evaluatePlanSwitch(order.seller_id).catch((err) => {
        console.error("[api/orders/confirm-delivery] plan switch", err)
      })
    }

    return NextResponse.json({ success: true, order_id: orderId })
  } catch (err) {
    console.error("[GWA] confirm-delivery error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
