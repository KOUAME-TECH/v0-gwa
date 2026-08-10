import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  createFeexPayPayout,
  getFeexPayCredentials,
  mapPaymentMethodToNetwork,
} from "@/lib/feexpay/client"
import {
  sumWalletAvailableFcfa,
} from "@/lib/wallet/balance"

/**
 * GET /api/wallet/withdraw — historique demandes
 * POST /api/wallet/withdraw — créer retrait (FeexPay payout ou pending ops)
 *
 * Anti double cash-out : solde = released EXCLU payout déjà paid (confirm).
 * Anti race : au plus une demande pending|processing à la fois.
 */
export async function GET() {
  try {
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
      if (/does not exist|relation/i.test(qErr.message)) {
        return NextResponse.json({ withdrawals: [], migration_required: true })
      }
      return NextResponse.json({ error: qErr.message }, { status: 500 })
    }

    const balance = await computeBalance(admin, user.id)
    return NextResponse.json({
      withdrawals: data || [],
      balance_fcfa: balance.available,
      gross_fcfa: balance.gross,
      withdrawn_fcfa: balance.withdrawn,
    })
  } catch (err) {
    console.error("[api/wallet/withdraw GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

async function computeBalance(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data: completed } = await admin
    .from("orders")
    .select(
      "vendeur_recoit_fcfa, total_amount, commission_fcfa, service_fee, payment_status, escrow_status, payout_status, status",
    )
    .eq("seller_id", userId)
    .eq("payment_status", "paid")
    .eq("escrow_status", "released")

  const { data: prior } = await admin
    .from("withdrawal_requests")
    .select("amount_fcfa, status")
    .eq("user_id", userId)
    .in("status", ["pending", "processing", "paid"])

  const already = (prior || []).reduce((s, w) => s + (Number(w.amount_fcfa) || 0), 0)
  return sumWalletAvailableFcfa(completed || [], already)
}

export async function POST(request: NextRequest) {
  try {
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
    const network = mapPaymentMethodToNetwork(
      String(body?.network || body?.method || "orange"),
    )

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from("profiles")
      .select("is_suspended")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.is_suspended) {
      return NextResponse.json(
        { error: "Compte suspendu", code: "SUSPENDED" },
        { status: 403 },
      )
    }

    // Une seule demande en cours (anti race + double withdraw)
    const { data: openReq } = await admin
      .from("withdrawal_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle()
    if (openReq) {
      return NextResponse.json(
        {
          error: "Une demande de retrait est déjà en cours",
          code: "WITHDRAWAL_IN_FLIGHT",
        },
        { status: 409 },
      )
    }

    let minWithdrawal = 1000
    try {
      const { data: setting } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", "min_withdrawal")
        .maybeSingle()
      const raw = setting?.value
      const parsed =
        typeof raw === "object" && raw && "XOF" in (raw as object)
          ? Number((raw as { XOF: number }).XOF)
          : Number(raw)
      if (Number.isFinite(parsed) && parsed >= 500) minWithdrawal = Math.round(parsed)
    } catch {
      /* défaut 1000 */
    }

    if (!Number.isFinite(amount) || amount < minWithdrawal) {
      return NextResponse.json(
        {
          error: `Montant minimum ${minWithdrawal.toLocaleString("fr-FR")} FCFA`,
          code: "AMOUNT_TOO_LOW",
          min_withdrawal_fcfa: minWithdrawal,
        },
        { status: 400 },
      )
    }
    if (phone.length < 8) {
      return NextResponse.json(
        { error: "Numéro Mobile Money invalide", code: "INVALID_PHONE" },
        { status: 400 },
      )
    }

    const balance = await computeBalance(admin, user.id)
    if (amount > balance.available) {
      return NextResponse.json(
        {
          error: "Solde insuffisant",
          code: "INSUFFICIENT_BALANCE",
          balance_fcfa: balance.available,
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

    // Re-check solde après insert (TOCTOU soft)
    const balanceAfter = await computeBalance(admin, user.id)
    if (balanceAfter.available < 0) {
      await admin
        .from("withdrawal_requests")
        .update({
          status: "failed",
          error_message: "BALANCE_RACE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", created.id)
      return NextResponse.json(
        { error: "Solde insuffisant (course)", code: "BALANCE_RACE" },
        { status: 409 },
      )
    }

    const creds = getFeexPayCredentials()
    if (creds) {
      await admin
        .from("withdrawal_requests")
        .update({ status: "processing", updated_at: now })
        .eq("id", created.id)

      const payout = await createFeexPayPayout({
        amountFcfa: amount,
        phone,
        network,
        description: `GWA withdraw ${created.id.slice(0, 8)}`,
      })

      if (payout.ok) {
        await admin
          .from("withdrawal_requests")
          .update({
            status: "paid",
            feexpay_ref: payout.reference,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", created.id)

        return NextResponse.json({
          withdrawal: { ...created, status: "paid", feexpay_ref: payout.reference },
          status: "paid",
          balance_fcfa: Math.max(0, balance.available - amount),
        })
      }

      await admin
        .from("withdrawal_requests")
        .update({
          status: "pending",
          error_message: payout.error || "PAYOUT_FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", created.id)

      return NextResponse.json({
        withdrawal: {
          ...created,
          status: "pending",
          error_message: payout.error,
        },
        status: "pending",
        message: "Demande enregistrée — payout en file ops",
      })
    }

    return NextResponse.json({
      withdrawal: created,
      status: "pending",
      message: "Demande enregistrée — activation FeexPay pour versement auto",
      balance_fcfa: Math.max(0, balance.available - amount),
    })
  } catch (err) {
    console.error("[api/wallet/withdraw POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
