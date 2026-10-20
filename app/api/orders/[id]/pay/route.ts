import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"
import { isPaymentSimulationAllowed } from "@/lib/payment/simulation"
import { resolveGeniusPayCredentials } from "@/lib/payment/geniuspay"

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/orders/[id]/pay
 * Vérifie la disponibilité du pay-in GeniusPay avant simulation locale.
 * Simulation uniquement hors prod / flag explicite.
 */
export async function POST(_request: Request, context: Ctx) {
  try {
    const rate = await checkRateLimit("PAYMENT")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 })
    }

    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, provider_reference")
      .eq("id", id)
      .maybeSingle()
    if (orderError) {
      if (
        orderError.code === "42703" ||
        /provider_reference.*column|column.*provider_reference/i.test(orderError.message)
      ) {
        return NextResponse.json(
          { error: "Migration 057 requise pour GeniusPay", code: "MIGRATION_REQUIRED" },
          { status: 503 },
        )
      }
      throw orderError
    }

    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    }
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
    if (order.payment_status === "paid" || order.escrow_status === "held") {
      return NextResponse.json({ error: "Déjà payée" }, { status: 400 })
    }

    const paymentMethod = "geniuspay"

    const admin = createAdminClient()
    const creds = await resolveGeniusPayCredentials()

    if (creds) {
      return NextResponse.json(
        {
          error:
            "Paiement suspendu : la signature officielle des requêtes GeniusPay doit être confirmée.",
          code: "GENIUSPAY_REQUEST_SIGNATURE_SPEC_REQUIRED",
        },
        { status: 503 },
      )
    }

    if (!isPaymentSimulationAllowed()) {
      return NextResponse.json(
        {
          error:
            "Paiements non configurés. Définissez GENIUSPAY_API_KEY + GENIUSPAY_API_SECRET.",
          code: "PAYMENT_PROVIDER_MISSING",
        },
        { status: 503 },
      )
    }

    const simulationReference = `SIM-GWA-${Date.now().toString(36).toUpperCase()}`
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        escrow_status: "held",
        status: "confirmed",
        provider_reference: simulationReference,
        payment_method: paymentMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    await admin
      .from("escrow_transactions")
      .update({
        status: "held",
        feexpay_ref: simulationReference,
        paid_at: new Date().toISOString(),
      })
      .eq("order_id", id)
      .eq("tranche_numero", 1)

    await admin.from("order_audit_log").insert({
      order_id: id,
      performed_by: user.id,
      action: "payment_simulated",
      new_value: "held",
      notes: "Paiement simulé (hors production / flag ALLOW_PAYMENT_SIMULATION)",
    })

    await admin.from("notifications").insert({
      user_id: order.seller_id,
      type: "order",
      title: "Paiement reçu (escrow)",
      message: `Commande ${order.order_number} payée — fonds en séquestre`,
      body: `Commande ${order.order_number} payée`,
      link: `/dashboard/commandes`,
      is_read: false,
      read: false,
    })

    void sendPushToUser(supabase as never, order.seller_id, {
      title: "Paiement escrow GWA",
      body: `${order.order_number} — fonds sécurisés`,
      url: "/dashboard/commandes",
    })

    return NextResponse.json({
      status: "paid_simulated",
      payment_reference: simulationReference,
      escrow_status: "held",
      payment_url: null,
      message: "Paiement simulé — configurez GeniusPay pour le live",
    })
  } catch (err) {
    console.error("[api/orders/pay]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
