import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications/push"
import { isPaymentSimulationAllowed } from "@/lib/payment/simulation"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/confirm
 * Acheteur confirme réception → release escrow et rend le solde vendeur demandable.
 * Les versements sont ensuite traités manuellement par l'équipe finance.
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

    let receptionPhotoUrl: string | null = null
    try {
      const body = await request.json()
      const raw =
        typeof body?.receptionPhotoUrl === "string" ? body.receptionPhotoUrl.trim() : ""
      if (raw && /^https?:\/\//i.test(raw) && raw.length < 800) {
        receptionPhotoUrl = raw
      }
    } catch {
      /* body vide OK */
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

    const payoutAmount =
      order.vendeur_recoit_fcfa != null
        ? Math.round(Number(order.vendeur_recoit_fcfa))
        : Math.max(
            0,
            Math.round(Number(order.total_amount) || 0) -
              Math.round(Number(order.commission_fcfa) || 0) -
              Math.round(Number(order.service_fee) || 0),
          )

    let payoutStatus = "pending"
    let payoutRef: string | null = null
    const payoutNetwork: string | null = null
    let payoutError: string | null = null

    if (isPaymentSimulationAllowed()) {
      payoutStatus = "skipped_sim"
      payoutRef = `SIM-OUT-${Date.now().toString(36).toUpperCase()}`
      payoutError = null
    } else if (payoutAmount <= 0) {
      payoutStatus = "skipped_zero"
      payoutError = null
    }

    const payoutOk =
      payoutStatus === "paid" ||
      payoutStatus === "skipped_sim" ||
      payoutStatus === "skipped_zero"

    const escrowStatus = "released"

    const orderPatch: Record<string, unknown> = {
      status: "delivered",
      escrow_status: escrowStatus,
      confirmed_by_buyer_at: now,
      delivered_at: order.delivered_at || now,
      updated_at: now,
      payout_status: payoutStatus,
      payout_ref: payoutRef,
      payout_network: payoutNetwork,
      payout_at: payoutOk ? now : null,
      payout_error: payoutError,
    }
    if (receptionPhotoUrl) {
      orderPatch.notes = [order.notes, `Photo réception: ${receptionPhotoUrl}`]
        .filter(Boolean)
        .join("\n")
        .slice(0, 2000)
    }

    const { error: updErr } = await admin.from("orders").update(orderPatch).eq("id", id)
    if (updErr) {
      console.warn("[api/orders/confirm] payout cols?", updErr.message)
      await admin
        .from("orders")
        .update({
          status: "delivered",
          escrow_status: escrowStatus,
          confirmed_by_buyer_at: now,
          delivered_at: order.delivered_at || now,
          updated_at: now,
        })
        .eq("id", id)
    }

    if (escrowStatus === "released") {
      await admin
        .from("escrow_transactions")
        .update({ status: "released", released_at: now })
        .eq("order_id", id)
        .eq("status", "held")
    }

    await admin.from("order_audit_log").insert({
      order_id: id,
      performed_by: user.id,
      action: payoutOk ? "buyer_confirmed" : "buyer_confirmed_payout_pending",
      new_value: escrowStatus,
      notes: [
        receptionPhotoUrl ? `Photo: ${receptionPhotoUrl}` : null,
        `payout=${payoutStatus}`,
        payoutRef ? `ref=${payoutRef}` : null,
        payoutError ? `err=${payoutError}` : null,
        `amount=${payoutAmount}`,
      ]
        .filter(Boolean)
        .join(" | "),
    })

    if (payoutOk) {
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
    }

    const sellerMsg =
      payoutStatus === "paid"
        ? `Fonds versés (${payoutAmount} FCFA) — ${order.order_number}`
        : payoutStatus === "pending"
          ? `Livraison confirmée — vous pouvez demander un versement manuel (${order.order_number})`
          : payoutStatus === "failed"
            ? `Livraison confirmée — versement à vérifier (${order.order_number})`
          : `L'acheteur a confirmé ${order.order_number}`

    await admin.from("notifications").insert({
      user_id: order.seller_id,
      type: "order",
      title:
        payoutStatus === "paid"
          ? "Paiement reçu"
          : payoutStatus === "pending"
            ? "Vente confirmée — versement disponible sur demande"
            : "Fonds libérés",
      message: sellerMsg,
      body: sellerMsg,
      link: `/wallet`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(supabase as never, order.seller_id, {
      title:
        payoutStatus === "paid"
          ? "Argent versé"
          : payoutStatus === "pending"
            ? "Vente confirmée"
            : "Fonds libérés",
      body: sellerMsg,
      url: "/wallet",
    })

    return NextResponse.json({
      success: true,
      escrow_status: escrowStatus,
      payout_status: payoutStatus,
      payout_ref: payoutRef,
      payout_amount_fcfa: payoutAmount,
      payout_error: payoutError,
      payout_pending: !payoutOk,
    })
  } catch (err) {
    console.error("[api/orders/confirm]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
