import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushToUser } from "@/lib/notifications/push"
import { mapPaymentMethodToNetwork } from "@/lib/payment/networks"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/confirm
 * Acheteur confirme réception → payout vendeur (net commission) + release escrow.
 * Si le payout échoue : commande livrée mais escrow reste held (file ops / retry).
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

    let payoutStatus = "skipped_no_provider"
    let payoutRef: string | null = null
    let payoutNetwork: string | null = null
    let payoutError: string | null = null

    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", order.seller_id)
      .maybeSingle()
    const sellerPhone = String(sellerProfile?.phone || "").trim()
    const network = mapPaymentMethodToNetwork(
      order.payment_method || order.payout_network || "orange",
    )

    if (payoutAmount <= 0) {
      payoutStatus = "skipped_zero"
    } else if (!sellerPhone) {
      payoutStatus = "failed"
      payoutError = "SELLER_PHONE_MISSING"
    } else {
      payoutNetwork = network
      payoutStatus = "pending_ops"
      payoutError = "GENIUSPAY_PAYOUT_REQUIRES_OPERATIONS_APPROVAL"
    }

    const payoutNotRequired = payoutAmount <= 0
    const payoutOk =
      payoutStatus === "paid" ||
      payoutStatus === "skipped_sim" ||
      payoutStatus === "skipped_zero"

    const escrowStatus = payoutOk ? "released" : "held"

    const orderPatch: Record<string, unknown> = {
      status: "delivered",
      escrow_status: escrowStatus,
      confirmed_by_buyer_at: now,
      delivered_at: order.delivered_at || now,
      updated_at: now,
      payout_status: payoutStatus,
      payout_ref: payoutRef,
      payout_at: payoutNotRequired ? now : null,
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
      action: payoutNotRequired
        ? "buyer_confirmed"
        : "buyer_confirmed_awaiting_manual_payout",
      new_value: escrowStatus,
      notes: [
        receptionPhotoUrl ? `Photo: ${receptionPhotoUrl}` : null,
        `payout=${payoutStatus}`,
        payoutRef ? `ref=${payoutRef}` : null,
        `amount=${payoutAmount}`,
      ]
        .filter(Boolean)
        .join(" | "),
    })

    if (payoutNotRequired) {
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
      payoutStatus === "pending"
        ? `Livraison confirmée — vous pouvez demander un versement manuel (${order.order_number})`
        : payoutStatus === "skipped_sim"
          ? `Livraison confirmée — paiement de simulation ignoré (${order.order_number})`
          : `L'acheteur a confirmé ${order.order_number}`

    await admin.from("notifications").insert({
      user_id: order.seller_id,
      type: "order",
      title:
        payoutStatus === "pending"
          ? "Vente confirmée — versement disponible sur demande"
          : payoutStatus === "skipped_sim"
            ? "Paiement de simulation"
            : "Fonds libérés",
      message: sellerMsg,
      body: sellerMsg,
      link: `/wallet`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(supabase as never, order.seller_id, {
      title:
        payoutStatus === "pending"
          ? "Vente confirmée"
          : payoutStatus === "skipped_sim"
            ? "Paiement de simulation"
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
      awaiting_manual_payout: payoutStatus === "pending",
    })
  } catch (err) {
    console.error("[api/orders/confirm]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
