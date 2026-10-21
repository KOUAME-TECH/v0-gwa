import { NextResponse } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { resolveGeniusPayCredentials } from "@/lib/payment/geniuspay"

/** GET /api/admin/stats — compteurs dashboard (service role) */
export async function GET() {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("dashboard")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const admin = gate.admin
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      usersResult,
      productsResult,
      pendingProductsResult,
      ordersResult,
      reportsResult,
      disputesResult,
      verificationsResult,
      newUsersResult,
      pendingOrdersResult,
      revenueResult,
      recentOrders,
      recentUsers,
      pendingProducts,
      supportResult,
      factoringResult,
      subscriptionResult,
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("products").select("*", { count: "exact", head: true }),
      admin
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("moderation_status", "pending"),
      admin.from("orders").select("*", { count: "exact", head: true }),
      admin
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("disputes")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "under_review"]),
      admin
        .from("verification_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
      admin
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "confirmed"]),
      admin.from("orders").select("total_amount").eq("payment_status", "paid"),
      admin
        .from("orders")
        .select(
          `id, order_number, total_amount, status, created_at,
          buyer:profiles!orders_buyer_id_fkey(full_name, avatar_url)`,
        )
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("profiles")
        .select("id, full_name, email, user_type, created_at, avatar_url")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("products")
        .select(
          `id, name, price, created_at, images,
          seller:profiles!products_seller_id_fkey(full_name)`,
        )
        .eq("moderation_status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("contact_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      admin
        .from("factoring_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      admin
        .from("subscription_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ])

    const totalRevenue =
      revenueResult.data?.reduce(
        (sum, order) => sum + (order.total_amount || 0),
        0,
      ) || 0

    const geniusPayCredentials = await resolveGeniusPayCredentials()
    const opsHealth = {
      geniuspay: Boolean(geniusPayCredentials),
      sms: Boolean(process.env.AT_SENDER_ID || process.env.SMS_AT_SENDER_ID),
      gemini: Boolean(
        process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      ),
    }

    return NextResponse.json({
      stats: {
        totalUsers: usersResult.count || 0,
        newUsersToday: newUsersResult.count || 0,
        totalProducts: productsResult.count || 0,
        pendingProducts: pendingProductsResult.count || 0,
        totalOrders: ordersResult.count || 0,
        pendingOrders: pendingOrdersResult.count || 0,
        totalRevenue,
        openReports: reportsResult.count || 0,
        openDisputes: disputesResult.count || 0,
        pendingVerifications: verificationsResult.count || 0,
        openSupport: supportResult.count || 0,
        pendingFactoring: factoringResult.count || 0,
        pendingSubscriptions: subscriptionResult.count || 0,
      },
      opsHealth,
      recentOrders: (recentOrders.data || []).map((o) => ({
        ...o,
        buyer: Array.isArray(o.buyer) ? o.buyer[0] : o.buyer,
      })),
      recentUsers: recentUsers.data || [],
      pendingProducts: (pendingProducts.data || []).map((p) => ({
        ...p,
        seller: Array.isArray(p.seller) ? p.seller[0] : p.seller,
      })),
    })
  } catch (err) {
    console.error("[api/admin/stats]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
