import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { isSellerRole } from "@/lib/dashboard/routing"
import { parsePagination } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_SEARCH")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }
    const { user, supabase, error } = await requireUser()
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
    const [{ data: orders, error: ordersError, count }, { data: summary, error: summaryError }] =
      await Promise.all([
        admin
          .from("orders")
          .select(
            "id, order_number, status, payment_status, escrow_status, payout_status, total_amount, vendeur_recoit_fcfa, commission_fcfa, service_fee, created_at",
            { count: "exact" },
          )
          .eq("seller_id", user.id)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),
        supabase.rpc("get_seller_earnings_summary"),
      ])

    if (ordersError) {
      console.error("[api/seller/earnings]", ordersError.message)
      return NextResponse.json({ error: "Historique indisponible" }, { status: 500 })
    }
    if (summaryError) {
      if (/get_seller_earnings_summary|function .*does not exist/i.test(summaryError.message)) {
        return NextResponse.json(
          { error: "Migration 065 requise pour le suivi des versements", code: "MIGRATION_REQUIRED" },
          { status: 503 },
        )
      }
      console.error("[api/seller/earnings summary]", summaryError.message)
      return NextResponse.json({ error: "Résumé des revenus indisponible" }, { status: 500 })
    }

    return NextResponse.json({
      orders: orders || [],
      total: count || 0,
      limit,
      offset,
      summary: summary || {},
    })
  } catch (err) {
    console.error("[api/seller/earnings]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
