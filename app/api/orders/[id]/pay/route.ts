import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"
import { createGeniusPayPayment, isGeniusPayConfigured } from "@/lib/payment/geniuspay"

type Ctx = { params: Promise<{ id: string }> }

function allowPaymentSimulation() {
  return process.env.ALLOW_PAYMENT_SIMULATION === "true" && process.env.NODE_ENV !== "production"
}

function appOrigin(request: NextRequest) {
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  if (env) return env
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  return host ? `${request.headers.get("x-forwarded-proto") || "https"}://${host}` : "https://mygwa.org"
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("PAYMENT")
    if (!rate.success) return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 })
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle()
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (order.buyer_id !== user.id) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    if (order.payment_status === "paid" || order.escrow_status === "held") return NextResponse.json({ error: "Déjà payée" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const { data: buyerProfile } = await supabase.from("profiles").select("phone, full_name, email").eq("id", user.id).maybeSingle()
    const phone = String(body?.phone || order.shipping_phone || buyerProfile?.phone || "").trim()
    const amount = Math.round(Number(order.total_amount) || 0)
    if (amount < 200) return NextResponse.json({ error: "Montant de commande invalide" }, { status: 400 })
    const admin = createAdminClient()
    const reference = `GWA-${id}-${Date.now().toString(36)}`

    if (await isGeniusPayConfigured()) {
      const payment = await createGeniusPayPayment({
        amount,
        description: `Commande ${order.order_number}`,
        customer: { name: buyerProfile?.full_name || undefined, email: buyerProfile?.email || user.email || undefined, phone, country: "CI" },
        metadata: { order_id: id, order_number: order.order_number },
        successUrl: `${appOrigin(request)}/commandes/confirmation?order=${id}`,
        errorUrl: `${appOrigin(request)}/commandes/${id}?payment=failed`,
      })
      const paymentUrl = payment.checkout_url || payment.payment_url
      if (!paymentUrl) {
        console.error("[api/orders/pay] GeniusPay returned no checkout URL", { reference: payment.reference })
        return NextResponse.json({ error: "Lien de paiement indisponible", code: "PAYMENT_URL_MISSING" }, { status: 502 })
      }
      const { error: orderUpdateError } = await admin
        .from("orders")
        .update({ payment_status: "processing", payment_reference: payment.reference, payment_method: "geniuspay", updated_at: new Date().toISOString() })
        .eq("id", id)
      if (orderUpdateError) {
        console.error("[api/orders/pay] order update", orderUpdateError)
        return NextResponse.json({ error: "Impossible d'enregistrer le paiement", code: "PAYMENT_STATE_FAILED" }, { status: 500 })
      }
      await admin.from("order_audit_log").insert({ order_id: id, performed_by: user.id, action: "geniuspay_payment_initiated", new_value: "processing", notes: `reference=${payment.reference}` })
      return NextResponse.json({ status: "redirect_required", reference: payment.reference, payment_url: paymentUrl })
    }

    if (!allowPaymentSimulation()) return NextResponse.json({ error: "Paiements GeniusPay non configurés", code: "PAYMENT_PROVIDER_MISSING" }, { status: 503 })
    await admin.from("orders").update({ payment_status: "paid", escrow_status: "held", status: "confirmed", payment_reference: reference, payment_method: "simulation", updated_at: new Date().toISOString() }).eq("id", id)
    await admin.from("escrow_transactions").update({ status: "held", payment_reference: reference, paid_at: new Date().toISOString() }).eq("order_id", id).eq("tranche_numero", 1)
    await admin.from("order_audit_log").insert({ order_id: id, performed_by: user.id, action: "payment_simulated", new_value: "held", notes: "Simulation locale uniquement" })
    await admin.from("notifications").insert({ user_id: order.seller_id, type: "order", title: "Paiement reçu (escrow)", message: `Commande ${order.order_number} payée — fonds en séquestre`, body: `Commande ${order.order_number} payée`, link: "/dashboard/commandes", is_read: false, read: false })
    void sendPushToUser(supabase as never, order.seller_id, { title: "Paiement escrow GWA", body: `${order.order_number} — fonds sécurisés`, url: "/dashboard/commandes" })
    return NextResponse.json({ status: "paid_simulated", reference, escrow_status: "held" })
  } catch (err) {
    console.error("[api/orders/pay]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
