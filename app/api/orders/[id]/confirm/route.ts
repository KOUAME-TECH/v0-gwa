import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth/require-admin"
import { sendPushToUser } from "@/lib/notifications/push"
import {
  createFeexPayPayout,
  getFeexPayCredentials,
  mapPaymentMethodToNetwork,
} from "@/lib/feexpay/client"
import {
  canBuyerConfirmReception,
  normalizeOrderStatus,
} from "@/lib/orders/escrow-flow"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/confirm
 * Acheteur confirme réception (après shipped) → claim atomique held → payout vendeur.
 * Anti-spéculation : pas de confirm précoce ; claim WHERE escrow=held ; SCG score_total.
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { id } = await context.params
    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user
    const supabase = gate.supabase

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

    if (
      !canBuyerConfirmReception({
        isSeller: false,
        payment_status: order.payment_status,
        escrow_status: order.escrow_status,
        status: order.status,
      })
    ) {
      const st = normalizeOrderStatus(order.status || "")
      return NextResponse.json(
        {
          error:
            st !== "shipped" && st !== "delivered"
              ? "Confirme la réception seulement après expédition (statut « En route »)."
              : "Impossible de libérer : paiement non confirmé ou fonds non en séquestre",
          code: "CONFIRM_NOT_ALLOWED",
        },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const now = new Date().toISOString()

    // Claim atomique anti double-confirm / double-payout
    const { data: claimed, error: claimErr } = await admin
      .from("orders")
      .update({
        payout_status: "processing",
        updated_at: now,
      })
      .eq("id", id)
      .eq("escrow_status", "held")
      .eq("payment_status", "paid")
      .select("*")
      .maybeSingle()

    if (claimErr || !claimed) {
      return NextResponse.json(
        {
          error: "Commande déjà en cours de libération ou non disponible",
          code: "ESCROW_CLAIM_FAILED",
        },
        { status: 409 },
      )
    }

    const { data: sellerProfile } = await admin
      .from("profiles")
      .select("phone, full_name")
      .eq("id", claimed.seller_id)
      .maybeSingle()

    const payoutAmount =
      claimed.vendeur_recoit_fcfa != null
        ? Math.round(Number(claimed.vendeur_recoit_fcfa))
        : Math.max(
            0,
            Math.round(Number(claimed.total_amount) || 0) -
              Math.round(Number(claimed.commission_fcfa) || 0) -
              Math.round(Number(claimed.service_fee) || 0),
          )

    let payoutStatus = "skipped_no_provider"
    let payoutRef: string | null = null
    let payoutNetwork: string | null = null
    let payoutError: string | null = null

    const creds = getFeexPayCredentials()
    const sellerPhone = String(sellerProfile?.phone || "").trim()
    const network = mapPaymentMethodToNetwork(
      claimed.payment_method || claimed.payout_network || "orange",
    )

    if (creds && payoutAmount > 0) {
      if (!sellerPhone) {
        payoutStatus = "failed"
        payoutError = "SELLER_PHONE_MISSING"
      } else {
        payoutNetwork = network
        const payout = await createFeexPayPayout({
          amountFcfa: payoutAmount,
          phone: sellerPhone,
          network,
          description: `GWA release ${claimed.order_number}`,
        })
        if (payout.ok) {
          payoutStatus = "paid"
          payoutRef = payout.reference
        } else {
          payoutStatus = "failed"
          payoutError = payout.error || "PAYOUT_FAILED"
          console.error("[api/orders/confirm] payout", payout.error, payout.raw)
        }
      }
    } else if (
      !creds &&
      process.env.ALLOW_PAYMENT_SIMULATION === "true" &&
      process.env.VERCEL_ENV !== "production" &&
      process.env.NODE_ENV !== "production"
    ) {
      payoutStatus = "skipped_sim"
      payoutRef = `SIM-OUT-${Date.now().toString(36).toUpperCase()}`
    } else if (!creds) {
      payoutStatus = "failed"
      payoutError = "PAYMENT_PROVIDER_MISSING"
    } else if (payoutAmount <= 0) {
      payoutStatus = "skipped_zero"
    }

    const payoutOk =
      payoutStatus === "paid" ||
      payoutStatus === "skipped_sim" ||
      payoutStatus === "skipped_zero"

    // Si payout OK → released (exclu du wallet). Si KO → held + créditer plus tard via ops.
    const escrowStatus = payoutOk ? "released" : "held"
    // Échec payout : repasser processing → null pour permettre retry ; rester held
    const finalPayoutStatus = payoutOk
      ? payoutStatus
      : payoutStatus === "failed"
        ? "failed"
        : payoutStatus

    const orderPatch: Record<string, unknown> = {
      status: "delivered",
      escrow_status: escrowStatus,
      confirmed_by_buyer_at: now,
      delivered_at: claimed.delivered_at || now,
      updated_at: now,
      payout_status: finalPayoutStatus,
      payout_ref: payoutRef,
      payout_network: payoutNetwork,
      payout_at: payoutOk ? now : null,
      payout_error: payoutError,
    }
    if (receptionPhotoUrl) {
      orderPatch.notes = [claimed.notes, `Photo réception: ${receptionPhotoUrl}`]
        .filter(Boolean)
        .join("\n")
        .slice(0, 2000)
    }

    const { error: updErr } = await admin
      .from("orders")
      .update(orderPatch)
      .eq("id", id)
      .eq("payout_status", "processing")

    if (updErr) {
      console.warn("[api/orders/confirm] payout cols?", updErr.message)
      await admin
        .from("orders")
        .update({
          status: "delivered",
          escrow_status: escrowStatus,
          confirmed_by_buyer_at: now,
          delivered_at: claimed.delivered_at || now,
          updated_at: now,
          payout_status: finalPayoutStatus,
        })
        .eq("id", id)
    }

    if (payoutOk) {
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
        `payout=${finalPayoutStatus}`,
        payoutRef ? `ref=${payoutRef}` : null,
        payoutError ? `err=${payoutError}` : null,
        `amount=${payoutAmount}`,
      ]
        .filter(Boolean)
        .join(" | "),
    })

    if (payoutOk) {
      const invoiceNumber = `FA-${claimed.order_number}`
      await admin.from("invoices").upsert(
        {
          order_id: id,
          number: invoiceNumber,
          buyer_id: claimed.buyer_id,
          seller_id: claimed.seller_id,
          total_fcfa: Math.round(Number(claimed.total_amount) || 0),
          issued_at: now,
        },
        { onConflict: "order_id", ignoreDuplicates: true },
      )
    }

    const sellerMsg =
      payoutStatus === "paid"
        ? `Fonds versés (${payoutAmount} FCFA) — ${claimed.order_number}`
        : payoutStatus === "failed"
          ? `Livraison confirmée — payout en file ops (${claimed.order_number})`
          : `L'acheteur a confirmé ${claimed.order_number}`

    await admin.from("notifications").insert({
      user_id: claimed.seller_id,
      type: "order",
      title:
        payoutStatus === "paid"
          ? "Paiement reçu"
          : payoutOk
            ? "Fonds libérés"
            : "Livraison confirmée — versement en cours",
      message: sellerMsg,
      body: sellerMsg,
      link: `/wallet`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(supabase as never, claimed.seller_id, {
      title:
        payoutStatus === "paid"
          ? "Argent versé"
          : payoutOk
            ? "Argent libéré"
            : "Confirmation reçue",
      body: sellerMsg,
      url: "/wallet",
    })

    try {
      const { aggregateProducerData } = await import("@/lib/scg/aggregate")
      const { calculateSCG } = await import("@/lib/scg/engine")
      const scgData = await aggregateProducerData(claimed.seller_id)
      const scg = calculateSCG(scgData)
      await admin
        .from("profiles")
        .update({
          scg_score: scg.score_total,
          scg_badge: scg.badge,
          scg_bancable: scg.bancable,
          scg_calculated_at: scg.calculated_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claimed.seller_id)
    } catch (scgErr) {
      console.warn("[api/orders/confirm] scg", scgErr)
    }

    return NextResponse.json({
      success: true,
      escrow_status: escrowStatus,
      payout_status: finalPayoutStatus,
      payout_ref: payoutRef,
      payout_amount_fcfa: payoutAmount,
      payout_error: payoutError,
      payout_pending: !payoutOk,
      review_cta: true,
    })
  } catch (err) {
    console.error("[api/orders/confirm]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
