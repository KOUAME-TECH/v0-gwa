<<<<<<< Updated upstream
import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/webhooks/feexpay
 * Webhook paiements — HMAC obligatoire ; MAJ via service role.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.FEEXPAY_WEBHOOK_SECRET
    if (!secret) {
      console.error("[webhooks/feexpay] FEEXPAY_WEBHOOK_SECRET manquant")
      return NextResponse.json(
        { error: "Webhook non configuré" },
        { status: 503 },
      )
    }

    const raw = await request.text()
    const sig =
      request.headers.get("x-feexpay-signature") ||
      request.headers.get("x-signature") ||
      ""

    if (!sig) {
      return NextResponse.json({ error: "Signature manquante" }, { status: 401 })
    }

    const expected = createHmac("sha256", secret).update(raw).digest("hex")
    const provided = sig.replace(/^sha256=/i, "").trim()
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(provided, "utf8")
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 })
    }

    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
    }

    const ref = String(
      payload.reference || payload.feexpay_ref || payload.ref || "",
    )
    const status = String(payload.status || payload.payment_status || "")
    if (!ref) {
      return NextResponse.json({ error: "reference manquante" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: order } = await admin
      .from("orders")
      .select("id, seller_id, order_number, total_amount, payment_status")
      .eq("feexpay_ref", ref)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ received: true, matched: false })
    }

    const paid =
      status === "success" ||
      status === "paid" ||
      status === "successful" ||
      status === "completed"

    if (paid) {
      // Idempotence : déjà payé
      if (order.payment_status === "paid") {
        return NextResponse.json({ received: true, matched: true, paid: true, idempotent: true })
      }

      const paidAmount = Number(
        payload.amount ?? payload.paid_amount ?? payload.montant ?? NaN,
      )
      const expected = Number(order.total_amount)
      if (
        Number.isFinite(paidAmount) &&
        Number.isFinite(expected) &&
        paidAmount + 1e-6 < expected
      ) {
        console.error(
          `[webhooks/feexpay] montant insuffisant ref=${ref} paid=${paidAmount} expected=${expected}`,
        )
        return NextResponse.json(
          { error: "Montant insuffisant", received: true, matched: true },
          { status: 422 },
        )
      }

      await admin
        .from("orders")
        .update({
          payment_status: "paid",
          escrow_status: "held",
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      await admin
        .from("escrow_transactions")
        .update({
          status: "held",
          feexpay_ref: ref,
          paid_at: new Date().toISOString(),
        })
        .eq("order_id", order.id)

      await admin.from("order_audit_log").insert({
        order_id: order.id,
        performed_by: null,
        action: "feexpay_webhook_paid",
        new_value: "held",
        notes: `Webhook Feexpay ${ref}`,
      })
    }

    return NextResponse.json({ received: true, matched: true, paid })
  } catch (err) {
    console.error("[webhooks/feexpay]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
=======
/**
 * POST /api/webhooks/feexpay
 * Webhook Feexpay — reçoit la confirmation de paiement
 * Mettre cette URL dans le dashboard Feexpay : https://votre-app.vercel.app/api/webhooks/feexpay
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendPushNotification } from "@/lib/notifications/push"
import { sendSMSFallback } from "@/lib/notifications/sms"

interface FeexpayWebhookPayload {
  id?: string
  reference?: string
  status?: string
  amount?: number
  phone?: string
  network?: string
  motif?: string
  // callback_info contient notre order reference
  callback_info?: string
  order_reference?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as FeexpayWebhookPayload

    // Extraire la référence Feexpay
    const feexpayRef = body.id ?? body.reference
    if (!feexpayRef) {
      return NextResponse.json({ error: "Référence manquante" }, { status: 400 })
    }

    const rawStatus = (body.status ?? "").toLowerCase()
    const isPaid = rawStatus === "success" || rawStatus === "successful" || rawStatus === "completed"

    if (!isPaid) {
      // Paiement échoué ou en attente — logger et ignorer
      console.log(`[GWA] Feexpay webhook status non-success: ${rawStatus} ref=${feexpayRef}`)
      return NextResponse.json({ received: true })
    }

    const supabase = await createClient()

    // Trouver la commande via feexpay_ref
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("feexpay_ref", feexpayRef)
      .maybeSingle()

    if (!order) {
      console.warn(`[GWA] Feexpay webhook: commande introuvable pour ref=${feexpayRef}`)
      return NextResponse.json({ received: true })
    }

    // Idempotence — ne pas traiter deux fois
    if (order.escrow_status === "held" || order.escrow_status === "released") {
      return NextResponse.json({ received: true, already_processed: true })
    }

    const now = new Date().toISOString()

    // Mettre à jour la commande
    await supabase
      .from("orders")
      .update({
        escrow_status: "held",
        status: "paiement_escrow",
        updated_at: now,
      })
      .eq("id", order.id)

    // Mettre à jour l'escrow_transaction tranche 1
    await supabase
      .from("escrow_transactions")
      .update({ status: "held", paid_at: now })
      .eq("order_id", order.id)
      .eq("tranche_numero", 1)

    // Log audit
    await supabase.from("order_audit_log").insert({
      order_id: order.id,
      action: "payment_confirmed",
      new_value: JSON.stringify({ feexpay_ref: feexpayRef, amount: body.amount, status: "held" }),
    }).then(() => null).catch(() => null)

    // Notifier vendeur : paiement sécurisé
    await sendPushNotification(order.seller_id, {
      title: "Paiement sécurisé reçu ! 💰",
      body: `Commande ${order.order_number} : ${order.total_amount?.toLocaleString("fr-FR")} FCFA bloqués. Préparez votre lot.`,
      data: { type: "payment", order_id: order.id },
    }).catch(() => null)

    await sendSMSFallback(order.seller_id, supabase,
      `GWA — Paiement sécurisé ! Commande #${order.order_number} : ${order.total_amount?.toLocaleString("fr-FR")} FCFA en escrow. Préparez le lot.`
    ).catch(() => null)

    // Notifier acheteur
    await sendPushNotification(order.buyer_id, {
      title: "Paiement confirmé ✓",
      body: `Votre commande ${order.order_number} est confirmée. Le vendeur prépare votre lot.`,
      data: { type: "order_status", order_id: order.id },
    }).catch(() => null)

    return NextResponse.json({ received: true, order_id: order.id })
  } catch (err) {
    console.error("[GWA] Feexpay webhook error:", err)
    // Retourner 200 pour éviter les rejeux répétés de Feexpay
    return NextResponse.json({ received: true, error: "internal" })
>>>>>>> Stashed changes
  }
}
