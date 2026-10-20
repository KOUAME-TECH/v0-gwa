import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, context: Ctx) {
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
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, total_amount, payment_status, payment_method, provider_reference")
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
    if (!order) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 })
    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
    if (order.payment_status === "paid") {
      const admin = createAdminClient()
      const now = new Date().toISOString()
      const { error: escrowError } = await admin
        .from("escrow_transactions")
        .update({ status: "held", paid_at: now })
        .eq("order_id", id)
        .eq("tranche_numero", 1)
        .eq("status", "pending")
      if (escrowError) throw escrowError
      return NextResponse.json({ status: "paid" })
    }
    if (order.payment_method !== "geniuspay" || !order.provider_reference) {
      return NextResponse.json({ error: "Référence GeniusPay introuvable" }, { status: 409 })
    }

    return NextResponse.json(
      {
        error:
          "Vérification suspendue : la signature officielle des requêtes GeniusPay doit être confirmée.",
        code: "GENIUSPAY_REQUEST_SIGNATURE_SPEC_REQUIRED",
      },
      { status: 503 },
    )
  } catch (err) {
    console.error("[api/orders/verify-payment]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
