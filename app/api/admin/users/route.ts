import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { isAdminRole, type AdminRole } from "@/lib/auth/admin-permissions"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizeForQuery } from "@/lib/security/validation"
import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * GET /api/admin/users
 * Liste profils + rôles admin (service role) — contourne RLS select-own post-035.
 */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdmin()
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const sp = request.nextUrl.searchParams
    const q = sanitizeForQuery((sp.get("q") || "").trim())
    const filterType = sp.get("type") || "all"
    const filterStatus = sp.get("status") || "all"
    const page = Math.max(0, Number(sp.get("page") || 0))
    const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") || 20)))

    const admin = gate.admin as AdminClient

    if (q) {
      const { data, error } = await admin
        .from("profiles")
        .select("*")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const enriched = await enrichWithAdminRoles(admin, data || [])
      return NextResponse.json({
        users: enriched,
        total: enriched.length,
        callerRole: gate.role.role,
      })
    }

    let query = admin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (filterType !== "all") {
      query = query.eq("user_type", filterType)
    }
    if (filterStatus === "verified") {
      query = query.eq("is_verified", true)
    } else if (filterStatus === "suspended") {
      query = query.eq("is_suspended", true)
    } else if (filterStatus === "unverified") {
      query = query.eq("is_verified", false)
    }

    const { data, count, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const enriched = await enrichWithAdminRoles(admin, data || [])
    return NextResponse.json({
      users: enriched,
      total: count || 0,
      callerRole: gate.role.role,
    })
  } catch (err) {
    console.error("[api/admin/users GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

async function enrichWithAdminRoles(
  admin: AdminClient,
  rows: Array<{ id: string } & Record<string, unknown>>,
) {
  if (!rows.length) return rows

  const ids = rows.map((u) => u.id)
  const { data: roles } = await admin
    .from("admin_roles")
    .select("user_id, role, is_active")
    .in("user_id", ids)
    .eq("is_active", true)

  const roleByUser = new Map<string, AdminRole>()
  for (const row of roles || []) {
    if (isAdminRole(row.role)) {
      roleByUser.set(row.user_id, row.role)
    }
  }

  return rows.map((u) => ({
    ...u,
    admin_role: roleByUser.get(u.id) ?? null,
  }))
}
