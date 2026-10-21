import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { mapPaymentMethodToNetwork } from "@/lib/payment/networks"
import { isWalletRegulatoryApprovalEnabled } from "@/lib/wallet/availability"

/**
 * GET /api/wallet/withdraw — historique demandes
 * POST /api/wallet/withdraw — créer une demande en file ops
 */
export async function GET() {
  try {
    if (!isWalletRegulatoryApprovalEnabled()) {
      return NextResponse.json({ error: "Fonctionnalité indisponible" }, { status: 404 })
    }
    const { user, error } = await requireUser()
    if (!user) {
      return NextResponse.json({ error: error || "Non authentifié" }, { status: 401 })
    }
    const admin = createAdminClient()
    const { data, error: qErr } = await admin
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (qErr) {
      // Table absente (migration 053)
      if (/does not exist|relation/i.test(qErr.message)) {
        return NextResponse.json({ withdrawals: [], migration_required: true })
      }
      return NextResponse.json({ error: qErr.message }, { status: 500 })
    }
    return NextResponse.json({ withdrawals: data || [] })
  } catch (err) {
    console.error("[api/wallet/withdraw GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isWalletRegulatoryApprovalEnabled()) {
      return NextResponse.json({ error: "Fonctionnalité indisponible" }, { status: 404 })
    }
    const rate = await checkRateLimit("PAYMENT")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 })
    }

    const { user, error } = await requireUser()
    if (!user) {
      return NextResponse.json({ error: error || "Non authentifié" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const amount = Math.round(Number(body?.amount_fcfa ?? body?.amount))
    const phone = String(body?.phone || "").trim()
    const network = mapPaymentMethodToNetwork(String(body?.network || body?.method || "orange"))

    if (!Number.isFinite(amount) || amount < 1000) {
      return NextResponse.json(
        { error: "Montant minimum 1 000 FCFA", code: "AMOUNT_TOO_LOW" },
        { status: 400 },
      )
    }
    if (phone.length < 8) {
      return NextResponse.json(
        { error: "Numéro Mobile Money invalide", code: "INVALID_PHONE" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Solde disponible = commandes livrées / escrow released
    const { data: completed } = await admin
      .from("orders")
      .select("vendeur_recoit_fcfa, total_amount, commission_fcfa, service_fee")
      .eq("seller_id", user.id)
      .eq("payment_status", "paid")
      .or("escrow_status.eq.released,status.eq.delivered")

    const available = (completed || []).reduce((sum, o) => {
      if (o.vendeur_recoit_fcfa != null) return sum + (Number(o.vendeur_recoit_fcfa) || 0)
      return (
        sum +
        (Number(o.total_amount) || 0) -
        (Number(o.commission_fcfa) || 0) -
        (Number(o.service_fee) || 0)
      )
    }, 0)

    const { data: prior } = await admin
      .from("withdrawal_requests")
      .select("amount_fcfa, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "paid"])

    const already = (prior || []).reduce((s, w) => s + (Number(w.amount_fcfa) || 0), 0)
    const balance = Math.max(0, available - already)

    if (amount > balance) {
      return NextResponse.json(
        {
          error: "Solde insuffisant",
          code: "INSUFFICIENT_BALANCE",
          balance_fcfa: balance,
        },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const insertPayload = {
      user_id: user.id,
      amount_fcfa: amount,
      phone,
      network,
      status: "pending" as const,
      created_at: now,
      updated_at: now,
    }

    const { data: created, error: insErr } = await admin
      .from("withdrawal_requests")
      .insert(insertPayload)
      .select()
      .single()

    if (insErr || !created) {
      if (insErr && /does not exist|relation/i.test(insErr.message)) {
        return NextResponse.json(
          {
            error: "Migration 053 requise (withdrawal_requests)",
            code: "MIGRATION_REQUIRED",
          },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { error: insErr?.message || "Création échouée" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      withdrawal: created,
      status: "pending",
      message: "Demande enregistrée — versement en attente de traitement ops.",
    })
  } catch (err) {
    console.error("[api/wallet/withdraw POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
