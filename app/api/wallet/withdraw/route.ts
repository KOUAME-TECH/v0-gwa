import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { mapPaymentMethodToNetwork } from "@/lib/payment/networks"
import { isWalletEnabled, walletDisabledResponse } from "@/lib/feature-flags/server"

/**
 * GET /api/wallet/withdraw — historique demandes
 * POST /api/wallet/withdraw — créer retrait (file ops sécurisée)
 */
export async function GET() {
  try {
    if (!(await isWalletEnabled())) return walletDisabledResponse()
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
    return NextResponse.json({ withdrawals: data || [], total: data?.length || 0, limit: 50, offset: 0 })
  } catch (err) {
    console.error("[api/wallet/withdraw GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isWalletEnabled())) return walletDisabledResponse()
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

    // Client admin (service_role) : le trigger prod protège l'INSERT.
    // Solde = liste blanche (get_seller_eligible_proceeds), pas vendeur_recoit_fcfa.
    const { data: proceedsRaw, error: proceedsErr } = await admin.rpc(
      "get_seller_eligible_proceeds",
      { p_seller_id: user.id },
    )
    if (proceedsErr) {
      if (/does not exist|schema cache|42883/i.test(proceedsErr.message)) {
        return NextResponse.json(
          { error: "Migration 065 requise (get_seller_eligible_proceeds)", code: "MIGRATION_REQUIRED" },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: proceedsErr.message }, { status: 500 })
    }
    const available = Math.max(0, Number(proceedsRaw) || 0)

    const { data: prior, error: priorErr } = await admin
      .from("withdrawal_requests")
      .select("amount_fcfa, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "queued"])

    if (priorErr && /does not exist|relation/i.test(priorErr.message)) {
      return NextResponse.json(
        { error: "Migration 053 requise (withdrawal_requests)", code: "MIGRATION_REQUIRED" },
        { status: 503 },
      )
    }

    if ((prior || []).length > 0) {
      return NextResponse.json(
        { error: "Une demande de versement est déjà en cours", code: "OPEN_REQUEST_EXISTS" },
        { status: 409 },
      )
    }

    const reserved = (prior || []).reduce((s, w) => s + (Number(w.amount_fcfa) || 0), 0)
    const balance = Math.max(0, available - reserved)

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
      message: "Demande enregistrée — versement traité par l'équipe opérations",
    })
  } catch (err) {
    console.error("[api/wallet/withdraw POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
