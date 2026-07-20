import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications/push"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/confirm
 * Acheteur confirme réception → release escrow (uniquement si payé + held).
 */
export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    }
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
    if (order.escrow_status === "released") {
      return NextResponse.json({ error: "Déjà libérée" }, { status: 400 })
    }
    if (order.payment_status !== "paid" || order.escrow_status !== "held") {
      return NextResponse.json(
        {
          error:
            "Impossible de libérer : paiement non confirmé ou fonds non en séquestre",
          code: "ESCROW_NOT_HELD",
        },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()

    await admin
      .from("orders")
      .update({
        status: "delivered",
        escrow_status: "released",
        confirmed_by_buyer_at: now,
        delivered_at: now,
        updated_at: now,
      })
      .eq("id", id)

    await admin
      .from("escrow_transactions")
      .update({ status: "released", released_at: now })
      .eq("order_id", id)
      .eq("status", "held")

    await admin.from("order_audit_log").insert({
      order_id: id,
      performed_by: user.id,
      action: "buyer_confirmed",
      new_value: "released",
      notes: "Confirmation réception — release escrow",
    })

    // Facture numérique (lean) — une par commande, idempotent via unique(order_id)
    const invoiceNumber = `FA-${order.order_number}`
    await admin.from("invoices").upsert(
      {
        order_id: id,
        number: invoiceNumber,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        total_fcfa: Math.round(Number(order.total_amount) || 0),
        issued_at: now,
      },
      { onConflict: "order_id", ignoreDuplicates: true },
    )

    await admin.from("notifications").insert({
      user_id: order.seller_id,
      type: "order",
      title: "Fonds libérés",
      message: `L'acheteur a confirmé ${order.order_number}`,
      body: `Fonds libérés pour ${order.order_number}`,
      link: `/wallet`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(supabase as never, order.seller_id, {
      title: "Escrow libéré",
      body: `${order.order_number} — paiement vendeur`,
      url: "/wallet",
    })

    return NextResponse.json({
      success: true,
      escrow_status: "released",
    })
  } catch (err) {
    console.error("[api/orders/confirm]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
