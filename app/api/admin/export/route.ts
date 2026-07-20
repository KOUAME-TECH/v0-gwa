import { type NextRequest, NextResponse } from "next/server"
import { type AdminAction } from "@/lib/auth/admin-permissions"
import { requireAdminAction } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

type Entity = "users" | "orders" | "products" | "factoring"

const ENTITY_CONFIG: Record<Entity, { table: string; columns: string[] }> = {
  users: {
    table: "profiles",
    columns: [
      "id", "full_name", "user_type", "sub_type", "phone", "city", "country",
      "is_verified", "is_suspended", "scg_score", "scg_badge", "scg_bancable", "created_at",
    ],
  },
  orders: {
    table: "orders",
    columns: [
      "id", "order_number", "buyer_id", "seller_id", "status", "payment_status",
      "escrow_status", "subtotal", "shipping_cost", "service_fee", "total_amount",
      "commission_fcfa", "vendeur_recoit_fcfa", "created_at", "delivered_at",
    ],
  },
  products: {
    table: "products",
    columns: [
      "id", "seller_id", "name", "filiere", "price", "prix_unitaire_fcfa", "unit",
      "stock_quantity", "status", "region", "ville", "created_at",
    ],
  },
  factoring: {
    table: "factoring_requests",
    columns: [
      "id", "requester_id", "order_id", "amount_fcfa", "status",
      "scg_score_snapshot", "scg_badge_snapshot", "decided_by", "decided_at", "created_at",
    ],
  },
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = typeof value === "object" ? JSON.stringify(value) : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * GET /api/admin/export?entity=users|orders|products|factoring
 * Export CSV (admin only, service role).
 */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_SEARCH")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const entity = request.nextUrl.searchParams.get("entity") as Entity | null
    if (!entity || !ENTITY_CONFIG[entity]) {
      return NextResponse.json(
        { error: "entity requis: users|orders|products|factoring" },
        { status: 400 },
      )
    }

    const exportAction: AdminAction = `export_${entity}` as AdminAction
    const gate = await requireAdminAction(exportAction)
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { table, columns } = ENTITY_CONFIG[entity]
    const { data, error } = await gate.admin
      .from(table)
      .select(columns.join(","))
      .order("created_at", { ascending: false })
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as Record<string, unknown>[]
    const header = columns.join(",")
    const body = rows
      .map((row) => columns.map((col) => csvEscape(row[col])).join(","))
      .join("\n")
    const csv = `${header}\n${body}`

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gwa-${entity}-${date}.csv"`,
      },
    })
  } catch (err) {
    console.error("[api/admin/export]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
