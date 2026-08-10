import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { calculateSCG } from "@/lib/scg/engine"
import { aggregateProducerData } from "@/lib/scg/aggregate"

/**
 * POST /api/reviews
 * Avis noté (1–5) lié à une commande livrée — alimente SCG.
 * Body: { order_id, rating, comment? }
 */
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user

    const body = await request.json().catch(() => ({}))
    const orderId = String(body?.order_id || "").trim()
    const rating = Math.round(Number(body?.rating))
    const comment =
      body?.comment != null
        ? String(body.comment)
            .replace(/<[^>]*>/g, "")
            .trim()
            .slice(0, 2000)
        : null

    if (!orderId) {
      return NextResponse.json(
        { error: "order_id requis", code: "ORDER_REQUIRED" },
        { status: 400 },
      )
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Note entre 1 et 5 requise", code: "INVALID_RATING" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: order } = await admin
      .from("orders")
      .select("id, buyer_id, seller_id, status, payment_status, escrow_status")
      .eq("id", orderId)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    }
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
    if (order.status !== "delivered" && order.escrow_status !== "released") {
      return NextResponse.json(
        {
          error: "Avis possible uniquement après livraison confirmée",
          code: "ORDER_NOT_DELIVERED",
        },
        { status: 400 },
      )
    }

    const { data: existing } = await admin
      .from("reviews")
      .select("id")
      .eq("order_id", orderId)
      .eq("reviewer_id", user.id)
      .gte("rating", 1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "Avis déjà déposé pour cette commande", code: "ALREADY_REVIEWED" },
        { status: 409 },
      )
    }

    const { data: review, error } = await admin
      .from("reviews")
      .insert({
        order_id: orderId,
        reviewer_id: user.id,
        seller_id: order.seller_id,
        rating,
        comment,
        review_type: "text",
      })
      .select("id, rating, comment, created_at")
      .single()

    if (error) {
      console.error("[api/reviews]", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Recalcul SCG vendeur (best-effort)
    try {
      const data = await aggregateProducerData(order.seller_id)
      const result = calculateSCG(data)
      await admin.from("profiles").update({
        scg_score: result.score_total,
        scg_badge: result.badge,
        scg_bancable: result.bancable,
        scg_calculated_at: result.calculated_at,
        updated_at: new Date().toISOString(),
      }).eq("id", order.seller_id)
    } catch (scgErr) {
      console.warn("[api/reviews] scg recalc", scgErr)
    }

    return NextResponse.json({ success: true, review })
  } catch (err) {
    console.error("[api/reviews]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
