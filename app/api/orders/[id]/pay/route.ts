import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"

type Ctx = { params: Promise<{ id: string }> }

function allowPaymentSimulation(): boolean {
  // Explicit opt-in always wins (must be set deliberately, incl. on previews).
  if (process.env.ALLOW_PAYMENT_SIMULATION === "true") return true
  // Fail closed everywhere else: only simulate on a local `next dev` machine,
  // i.e. NODE_ENV=development AND no Vercel environment (preview/production) present.
  return process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV
}

/**
 * POST /api/orders/[id]/pay
 * Initie le paiement escrow. Simulation uniquement hors prod (ou flag explicite).
 */
export async function POST(request: NextRequest, context: Ctx) {
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
    if (order.payment_status === "paid" || order.escrow_status === "held") {
      return NextResponse.json({ error: "Déjà payée" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const feexpayKey = process.env.FEEXPAY_API_KEY
    const feexpayRef = `GWA-${Date.now().toString(36).toUpperCase()}`
    const admin = createAdminClient()

    if (feexpayKey && process.env.FEEXPAY_SHOP_ID) {
      await admin
        .from("orders")
        .update({
          payment_status: "processing",
          feexpay_ref: feexpayRef,
          payment_method: body?.payment_method || order.payment_method,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      return NextResponse.json({
        status: "redirect_required",
        feexpay_ref: feexpayRef,
        payment_url: null,
        message:
          "Compte Feexpay configuré — finaliser l'intégration SDK marchand",
      })
    }

    if (!allowPaymentSimulation()) {
      return NextResponse.json(
        {
          error:
            "Paiements live non configurés. Définissez FEEXPAY_API_KEY + FEEXPAY_SHOP_ID.",
          code: "PAYMENT_PROVIDER_MISSING",
        },
        { status: 503 },
      )
    }

    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        escrow_status: "held",
        status: "confirmed",
        feexpay_ref: `SIM-${feexpayRef}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    await admin
      .from("escrow_transactions")
      .update({
        status: "held",
        feexpay_ref: `SIM-${feexpayRef}`,
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
      feexpay_ref: `SIM-${feexpayRef}`,
      escrow_status: "held",
      message: "Paiement simulé — configurez FEEXPAY_* pour le live",
    })
  } catch (err) {
    console.error("[api/orders/pay]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
