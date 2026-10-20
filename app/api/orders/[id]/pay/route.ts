import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"
import { isPaymentSimulationAllowed } from "@/lib/payment/simulation"
import {
  createGeniusPayCheckout,
  resolveGeniusPayCredentials,
} from "@/lib/payment/geniuspay"

type Ctx = { params: Promise<{ id: string }> }

function appOrigin(request: NextRequest): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  if (env) return env
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") || "https"
  if (host) return `${proto}://${host}`
  return "https://v0-gwa-mu.vercel.app"
}

/**
 * POST /api/orders/[id]/pay
 * Initie un checkout GeniusPay côté serveur.
 * Simulation uniquement hors prod / flag explicite.
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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, provider_reference")
      .eq("id", id)
      .maybeSingle()
    if (orderError) {
      if (/provider_reference|column/i.test(orderError.message)) {
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

    const body = await request.json().catch(() => ({}))
    const paymentMethod = "geniuspay"

    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("id", user.id)
      .maybeSingle()

    const phone = String(body?.phone || order.shipping_phone || buyerProfile?.phone || "").trim()

    const admin = createAdminClient()
    const creds = await resolveGeniusPayCredentials()
    const amount = Math.round(Number(order.total_amount) || 0)
    const origin = appOrigin(request)
    const returnUrl = `${origin}/commandes/confirmation?order=${encodeURIComponent(id)}`

    if (creds) {
      if (amount < 200) {
        return NextResponse.json(
          { error: "Montant minimum GeniusPay : 200 XOF", code: "AMOUNT_TOO_LOW" },
          { status: 400 },
        )
      }

      const { data: reservation, error: reservationError } = await admin
        .from("orders")
        .update({
          payment_status: "processing",
          payment_method: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("payment_status", ["pending", "failed"])
        .select("id")
        .maybeSingle()
      if (reservationError) throw reservationError
      if (!reservation) {
        return NextResponse.json(
          { error: "Un paiement est déjà en cours ou cette commande n’est pas payable.", code: "PAYMENT_ALREADY_STARTED" },
          { status: 409 },
        )
      }

      const payIn = await createGeniusPayCheckout({
        amount,
        orderId: id,
        description: `Commande GWA ${order.order_number}`,
        customerName: buyerProfile?.full_name || undefined,
        customerPhone: phone || undefined,
        successUrl: returnUrl,
        errorUrl: `${returnUrl}&payment=failed`,
      })

      if (!payIn.ok) {
        console.error("[api/orders/pay] GeniusPay", payIn.error)
        if (!payIn.uncertain) {
          await admin
            .from("orders")
            .update({ payment_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("payment_status", "processing")
        }
        return NextResponse.json(
          {
            error: payIn.uncertain
              ? "Résultat d’initiation incertain. N’essayez pas de repayer ; contactez le support."
              : "Échec initiation paiement GeniusPay",
            code: payIn.error || "PAYIN_FAILED",
          },
          { status: 502 },
        )
      }

      const { error: referenceError } = await admin
        .from("orders")
        .update({
          payment_status: "processing",
          provider_reference: payIn.data.reference,
          payment_method: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("payment_status", "processing")
      if (referenceError) {
        console.error("[api/orders/pay] GeniusPay reference persistence failed", {
          orderId: id,
          reference: payIn.data.reference,
        })
        return NextResponse.json(
          { error: "Paiement créé mais référence non enregistrée. Contactez le support.", code: "PAYMENT_REFERENCE_SAVE_FAILED" },
          { status: 503 },
        )
      }

      await admin.from("order_audit_log").insert({
        order_id: id,
        performed_by: user.id,
        action: "geniuspay_payin_initiated",
        new_value: "processing",
        notes: `ref=${payIn.data.reference} amount=${amount} currency=XOF`,
      })

      return NextResponse.json({
        status: "redirect_required",
        payment_reference: payIn.data.reference,
        payment_url: payIn.data.checkoutUrl,
        message: "Redirection vers GeniusPay pour finaliser le paiement",
      })
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

    const feexpayRef = `SIM-GWA-${Date.now().toString(36).toUpperCase()}`
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        escrow_status: "held",
        status: "confirmed",
        provider_reference: feexpayRef,
        payment_method: paymentMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    await admin
      .from("escrow_transactions")
      .update({
        status: "held",
        feexpay_ref: feexpayRef,
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
      feexpay_ref: feexpayRef,
      escrow_status: "held",
      payment_url: null,
      message: "Paiement simulé — configurez GeniusPay pour le live",
    })
  } catch (err) {
    console.error("[api/orders/pay]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
