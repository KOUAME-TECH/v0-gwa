import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

const ALLOWED_PERIODS = new Set([7, 30, 90, 365])

/**
 * GET /api/admin/finances
 * Agrégats commandes (service role) — revenus, escrow, paiements.
 * Query: period (jours, défaut 30)
 */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("finances")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const periodRaw = Number(request.nextUrl.searchParams.get("period") || 30)
    const periodDays = ALLOWED_PERIODS.has(periodRaw) ? periodRaw : 30

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - periodDays)

    const admin = gate.admin

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        "id, order_number, total_amount, commission_fcfa, status, payment_status, escrow_status, created_at",
      )
      .gte("created_at", daysAgo.toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const rows = orders || []

    const byPaymentStatus: Record<string, { count: number; total: number }> = {}
    const byEscrowStatus: Record<string, { count: number; total: number }> = {}

    let totalRevenue = 0
    let escrowBalance = 0
    let completedOrders = 0
    let totalCommissions = 0

    for (const o of rows) {
      const amount = Number(o.total_amount) || 0
      const commission = Number(o.commission_fcfa) || 0
      const pay = o.payment_status || "pending"
      const esc = o.escrow_status || "pending"

      if (!byPaymentStatus[pay]) byPaymentStatus[pay] = { count: 0, total: 0 }
      byPaymentStatus[pay].count += 1
      byPaymentStatus[pay].total += amount

      if (!byEscrowStatus[esc]) byEscrowStatus[esc] = { count: 0, total: 0 }
      byEscrowStatus[esc].count += 1
      byEscrowStatus[esc].total += amount

      if (pay === "paid") {
        totalRevenue += amount
        totalCommissions += commission
      }

      if (esc === "held") {
        escrowBalance += amount
      }

      if (o.status === "delivered" || esc === "released") {
        completedOrders += 1
      }
    }

    const transactions = rows.slice(0, 20).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      type: "order",
      amount: Number(o.total_amount) || 0,
      status: o.status,
      payment_status: o.payment_status,
      escrow_status: o.escrow_status,
      created_at: o.created_at,
    }))

    return NextResponse.json({
      period: periodDays,
      stats: {
        totalRevenue,
        totalCommissions,
        completedOrders,
        escrowBalance,
        ordersCount: rows.length,
      },
      byPaymentStatus,
      byEscrowStatus,
      transactions,
    })
  } catch (err) {
    console.error("[api/admin/finances]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
