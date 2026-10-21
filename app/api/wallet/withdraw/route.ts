import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { isSellerRole } from "@/lib/dashboard/routing"
import { validateManualPayoutRequest } from "@/lib/wallet/manual-payout"
import { parsePagination } from "@/lib/pagination"

/**
 * GET /api/wallet/withdraw — historique demandes
 * POST /api/wallet/withdraw — créer une demande en file ops
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (!user) {
      return NextResponse.json({ error: error || "Non authentifié" }, { status: 401 })
    }
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()
    if (!isSellerRole(profile?.user_type)) {
      return NextResponse.json({ error: "Espace réservé aux vendeurs" }, { status: 403 })
    }
    const { limit, offset } = parsePagination(request.nextUrl.searchParams)
    const { data, count, error: qErr } = await admin
      .from("withdrawal_requests")
      .select("id, amount_fcfa, network, phone, status, payout_reference, admin_notes, created_at, updated_at, processed_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (qErr) {
      // Table absente (migration 053)
      if (/does not exist|relation/i.test(qErr.message)) {
        return NextResponse.json({ withdrawals: [], migration_required: true })
      }
      return NextResponse.json({ error: qErr.message }, { status: 500 })
    }
    return NextResponse.json({ withdrawals: data || [], total: count || 0, limit, offset })
  } catch (err) {
    console.error("[api/wallet/withdraw GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit("PAYMENT")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 })
    }

    const { user, error, supabase } = await requireUser()
    if (!user) {
      return NextResponse.json({ error: error || "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()
    if (!isSellerRole(profile?.user_type)) {
      return NextResponse.json({ error: "Espace réservé aux vendeurs" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = validateManualPayoutRequest({
      amount: Number(body?.amount_fcfa ?? body?.amount),
      phone: String(body?.phone || ""),
      network: String(body?.network || ""),
    })
    if (!validation.ok) {
      const errorByCode = {
        INVALID_AMOUNT: { message: "Montant minimum 1 000 FCFA", status: 400 },
        INSUFFICIENT_BALANCE: { message: "Montant supérieur au disponible", status: 400 },
        INVALID_PHONE: { message: "Numéro Mobile Money invalide", status: 400 },
        INVALID_NETWORK: { message: "Réseau Mobile Money non pris en charge", status: 400 },
      } as const
      const error = errorByCode[validation.code]
      return NextResponse.json({ error: error.message, code: validation.code }, { status: error.status })
    }

    const { data: requestId, error: rpcError } = await supabase.rpc(
      "request_manual_payout",
      {
        p_amount_fcfa: validation.amount,
        p_phone: validation.phone,
        p_network: validation.network,
      },
    )
    if (rpcError || !requestId) {
      if (/function .*request_manual_payout|does not exist/i.test(rpcError?.message || "")) {
        return NextResponse.json(
          { error: "Migration 065 requise pour les demandes de versement", code: "MIGRATION_REQUIRED" },
          { status: 503 },
        )
      }
      if (/insufficient available balance/i.test(rpcError?.message || "")) {
        return NextResponse.json({ error: "Montant supérieur au disponible", code: "INSUFFICIENT_BALANCE" }, { status: 400 })
      }
      if (/seller role required/i.test(rpcError?.message || "")) {
        return NextResponse.json({ error: "Espace réservé aux vendeurs" }, { status: 403 })
      }
      console.error("[api/wallet/withdraw POST]", rpcError?.message)
      return NextResponse.json({ error: "Demande impossible pour le moment" }, { status: 400 })
    }

    const { data: created } = await admin
      .from("withdrawal_requests")
      .select("id, amount_fcfa, network, phone, status, created_at")
      .eq("id", requestId)
      .eq("user_id", user.id)
      .single()

    return NextResponse.json({
      withdrawal: created,
      status: "pending",
      message: "Demande enregistrée. Le versement sera traité manuellement par notre équipe.",
    })
  } catch (err) {
    console.error("[api/wallet/withdraw POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
