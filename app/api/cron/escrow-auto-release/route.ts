import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { authorizeCronRequest } from "@/lib/security/cron-auth"
import {
  createFeexPayPayout,
  getFeexPayCredentials,
  mapPaymentMethodToNetwork,
} from "@/lib/feexpay/client"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const DEFAULT_AUTO_RELEASE_DAYS = 7

/**
 * POST|GET /api/cron/escrow-auto-release
 * Libère les commandes held + shipped/delivered après N jours sans litige.
 * Bearer CRON_SECRET obligatoire en prod.
 */
async function handle(request: Request) {
  const auth = authorizeCronRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const days = Math.max(
    1,
    Number(process.env.GWA_ESCROW_AUTO_RELEASE_DAYS || DEFAULT_AUTO_RELEASE_DAYS) ||
      DEFAULT_AUTO_RELEASE_DAYS,
  )
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const admin = createAdminClient()
  const creds = getFeexPayCredentials()

  const { data: candidates, error } = await admin
    .from("orders")
    .select(
      "id, order_number, seller_id, vendeur_recoit_fcfa, total_amount, commission_fcfa, service_fee, payment_method, payout_network, status, escrow_status, shipped_at, delivered_at, confirmed_by_buyer_at, updated_at",
    )
    .eq("payment_status", "paid")
    .eq("escrow_status", "held")
    .in("status", ["shipped", "delivered"])
    .limit(40)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let released = 0
  let failed = 0
  let skipped = 0

  for (const order of candidates || []) {
    const anchor =
      order.shipped_at ||
      order.delivered_at ||
      order.confirmed_by_buyer_at ||
      order.updated_at
    if (!anchor || anchor > cutoff) {
      skipped++
      continue
    }

    const now = new Date().toISOString()
    const { data: claimed } = await admin
      .from("orders")
      .update({ payout_status: "processing", updated_at: now })
      .eq("id", order.id)
      .eq("escrow_status", "held")
      .select("id, seller_id, order_number, vendeur_recoit_fcfa, total_amount, commission_fcfa, service_fee, payment_method, payout_network")
      .maybeSingle()

    if (!claimed) {
      skipped++
      continue
    }

    const amount =
      claimed.vendeur_recoit_fcfa != null
        ? Math.round(Number(claimed.vendeur_recoit_fcfa))
        : Math.max(
            0,
            Math.round(Number(claimed.total_amount) || 0) -
              Math.round(Number(claimed.commission_fcfa) || 0) -
              Math.round(Number(claimed.service_fee) || 0),
          )

    const { data: seller } = await admin
      .from("profiles")
      .select("phone")
      .eq("id", claimed.seller_id)
      .maybeSingle()
    const phone = String(seller?.phone || "").trim()
    const network = mapPaymentMethodToNetwork(
      claimed.payment_method || claimed.payout_network || "orange",
    )

    let payoutStatus = "credited_wallet"
    let payoutRef: string | null = null
    let payoutError: string | null = null

    if (creds && amount > 0 && phone) {
      const payout = await createFeexPayPayout({
        amountFcfa: amount,
        phone,
        network,
        description: `GWA auto-release ${claimed.order_number}`,
      })
      if (payout.ok) {
        payoutStatus = "paid"
        payoutRef = payout.reference
      } else {
        payoutStatus = "credited_wallet"
        payoutError = payout.error || "PAYOUT_FAILED_CREDITED_WALLET"
      }
    }

    await admin
      .from("orders")
      .update({
        status: "delivered",
        escrow_status: "released",
        payout_status: payoutStatus,
        payout_ref: payoutRef,
        payout_error: payoutError,
        payout_at: now,
        delivered_at: order.delivered_at || now,
        updated_at: now,
      })
      .eq("id", claimed.id)

    await admin
      .from("escrow_transactions")
      .update({ status: "released", released_at: now })
      .eq("order_id", claimed.id)
      .eq("status", "held")

    await admin.from("order_audit_log").insert({
      order_id: claimed.id,
      performed_by: null,
      action: "escrow_auto_release",
      new_value: "released",
      notes: `auto ${days}j payout=${payoutStatus}`,
    })

    if (payoutStatus === "paid" || payoutStatus === "credited_wallet") {
      released++
    } else {
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    auth_via: auth.via,
    days,
    candidates: candidates?.length || 0,
    released,
    failed,
    skipped,
  })
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
