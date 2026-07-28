import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { canAccessSellerStats, entitlementsForTier } from "@/lib/pricing/entitlements"
import { normalizeSubscriptionTier } from "@/lib/pricing/service-fee"

/**
 * GET /api/seller/stats
 * Stats vendeur — Starter+ (entitlement simpleStats).
 */
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (!user) {
      return NextResponse.json({ error: error || "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("subscription_tier, user_type")
      .eq("id", user.id)
      .maybeSingle()

    const tier = normalizeSubscriptionTier(profile?.subscription_tier)
    const entitlements = entitlementsForTier(tier)

    if (!canAccessSellerStats(tier)) {
      return NextResponse.json(
        {
          error: "Stats vendeur réservées aux paliers Starter et plus.",
          code: "PLAN_REQUIRED",
          required_tier: "starter",
          current_tier: tier,
          upgrade_path: "/abonnement",
        },
        { status: 403 },
      )
    }

    const { data: products } = await admin
      .from("products")
      .select("id, status, views_count")
      .eq("seller_id", user.id)

    const activeListings = (products || []).filter((p) => p.status === "active").length
    const views = (products || []).reduce((s, p) => s + (Number(p.views_count) || 0), 0)

    const { data: allOrders } = await admin
      .from("orders")
      .select(
        "id, total_amount, commission_fcfa, vendeur_recoit_fcfa, status, payment_status, escrow_status, created_at",
      )
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)

    const orders = allOrders || []
    const paid = orders.filter((o) => o.payment_status === "paid")
    const delivered = orders.filter(
      (o) => o.status === "delivered" || o.escrow_status === "released",
    )
    const gmv = paid.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)
    const net = delivered.reduce((s, o) => {
      if (o.vendeur_recoit_fcfa != null) return s + (Number(o.vendeur_recoit_fcfa) || 0)
      return s + (Number(o.total_amount) || 0) - (Number(o.commission_fcfa) || 0)
    }, 0)
    const commissions = paid.reduce((s, o) => s + (Number(o.commission_fcfa) || 0), 0)

    return NextResponse.json({
      tier,
      entitlements: {
        simpleStats: entitlements.simpleStats,
        reporting: entitlements.reporting,
        feedPriority: entitlements.feedPriority,
        factoringPriority: entitlements.factoringPriority,
        proBadge: entitlements.proBadge,
      },
      stats: {
        active_listings: activeListings,
        product_views: views,
        orders_total: orders.length,
        orders_paid: paid.length,
        orders_delivered: delivered.length,
        gmv_fcfa: gmv,
        net_fcfa: net,
        commissions_fcfa: commissions,
      },
    })
  } catch (err) {
    console.error("[api/seller/stats]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
