<<<<<<< Updated upstream
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"
import {
  createFeexPayPayIn,
  getFeexPayCredentials,
  mapPaymentMethodToNetwork,
} from "@/lib/feexpay/client"

type Ctx = { params: Promise<{ id: string }> }

function allowPaymentSimulation(): boolean {
  if (process.env.ALLOW_PAYMENT_SIMULATION === "true") return true
  return process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV
}

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
 * Initie pay-in FeexPay (requesttopay) → payment_url ou USSD pending.
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
    const paymentMethod =
      String(body?.payment_method || order.payment_method || "orange").trim()
    const network = mapPaymentMethodToNetwork(paymentMethod)

    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .eq("id", user.id)
      .maybeSingle()

    const phone =
      String(body?.phone || order.shipping_phone || buyerProfile?.phone || "").trim()

    const admin = createAdminClient()
    const creds = getFeexPayCredentials()
    const amount = Math.round(Number(order.total_amount) || 0)
    const origin = appOrigin(request)
    const returnUrl = `${origin}/commandes/confirmation?order=${id}`

    if (creds) {
      if (!phone) {
        return NextResponse.json(
          {
            error: "Numéro Mobile Money requis pour payer",
            code: "PHONE_REQUIRED",
          },
          { status: 400 },
        )
      }

      const nameParts = String(buyerProfile?.full_name || "").trim().split(/\s+/)
      const payIn = await createFeexPayPayIn({
        amountFcfa: amount,
        phone,
        network,
        description: `GWA ${order.order_number}`,
        firstName: nameParts[0] || "Acheteur",
        lastName: nameParts.slice(1).join(" ") || "GWA",
        returnUrl,
        callbackInfo: JSON.stringify({ order_id: id, order_number: order.order_number }),
      })

      if (!payIn.ok) {
        console.error("[api/orders/pay] feexpay pay-in", payIn.error, payIn.raw)
        return NextResponse.json(
          {
            error: "Échec initiation paiement FeexPay",
            code: payIn.error || "PAYIN_FAILED",
            details: payIn.raw,
          },
          { status: 502 },
        )
      }

      const feexpayRef =
        payIn.reference || `GWA-${Date.now().toString(36).toUpperCase()}`

      await admin
        .from("orders")
        .update({
          payment_status: "processing",
          feexpay_ref: feexpayRef,
          payment_method: paymentMethod,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      await admin.from("order_audit_log").insert({
        order_id: id,
        performed_by: user.id,
        action: "feexpay_payin_initiated",
        new_value: "processing",
        notes: `ref=${feexpayRef} network=${network} url=${payIn.paymentUrl ? "yes" : "ussd"}`,
      })

      return NextResponse.json({
        status: payIn.paymentUrl ? "redirect_required" : "ussd_pending",
        feexpay_ref: feexpayRef,
        payment_url: payIn.paymentUrl,
        network,
        message: payIn.paymentUrl
          ? "Redirige vers FeexPay pour finaliser le paiement"
          : "Valide le paiement sur ton téléphone (USSD / push MM)",
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

    const feexpayRef = `SIM-GWA-${Date.now().toString(36).toUpperCase()}`
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        escrow_status: "held",
        status: "confirmed",
        feexpay_ref: feexpayRef,
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
      message: "Paiement simulé — configurez FEEXPAY_* pour le live",
    })
  } catch (err) {
    console.error("[api/orders/pay]", err)
=======
/**
 * POST /api/orders/[id]/pay
 * Initie le paiement escrow via Feexpay
 * Body: { paiement_type, phone_paiement }
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { capturePayment, type FeexpayNetwork } from "@/lib/payment/feexpay"
import { sendPushNotification } from "@/lib/notifications/push"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const body = await request.json()
    const { paiement_type, phone_paiement } = body as {
      paiement_type: FeexpayNetwork
      phone_paiement: string
    }

    // Charger la commande
    const { data: order } = await supabase
      .from("orders")
      .select("*, profiles!orders_seller_id_fkey(full_name)")
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .single()

    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (order.escrow_status !== "pending") {
      return NextResponse.json({ error: "Cette commande a déjà été payée" }, { status: 400 })
    }

    // Charger profil acheteur pour le nom
    const { data: buyer } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single()

    const nameParts = (buyer?.full_name ?? "").split(" ")

    // Appel Feexpay
    const result = await capturePayment({
      amount: order.total_amount,
      phoneNumber: phone_paiement,
      network: paiement_type,
      motif: `Commande GWA ${order.order_number}`,
      orderId: order.id,
      buyerEmail: user.email,
      buyerFirstName: nameParts[0],
      buyerLastName: nameParts.slice(1).join(" "),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message ?? "Échec du paiement" }, { status: 400 })
    }

    // Mettre à jour la commande — statut en attente webhook
    await supabase
      .from("orders")
      .update({
        feexpay_ref: result.feexpay_ref,
        paiement_type,
        status: "paiement_escrow",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    // Mettre à jour escrow_transaction tranche 1
    await supabase
      .from("escrow_transactions")
      .update({
        feexpay_ref: result.feexpay_ref,
        paid_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .eq("tranche_numero", 1)

    // Notif acheteur
    await sendPushNotification(user.id, {
      title: "Paiement en cours...",
      body: `Validez le paiement de ${order.total_amount.toLocaleString("fr-FR")} FCFA sur votre téléphone.`,
      data: { type: "payment", order_id: orderId },
    }).catch(() => null)

    return NextResponse.json({
      success: true,
      feexpay_ref: result.feexpay_ref,
      message: "Confirmez le paiement sur votre téléphone.",
    })
  } catch (err) {
    console.error("[GWA] /api/orders/[id]/pay error:", err)
>>>>>>> Stashed changes
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
