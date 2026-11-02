import { type NextRequest, NextResponse } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { assertSameOrigin } from "@/lib/security/csrf"
import { sanitizeForQuery } from "@/lib/security/validation"
import { normalizeSubscriptionTier } from "@/lib/pricing/service-fee"

/** GET /api/admin/subscriptions — file demandes abo + recherche */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("subscriptions")
    if (!gate.isAdmin || !gate.admin || !gate.role) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const sp = request.nextUrl.searchParams
    const status = sp.get("status") || "pending"
    const tierRaw = (sp.get("tier") || "all").toLowerCase()
    const q = sanitizeForQuery((sp.get("q") || "").trim())

    let matchingUserIds: string[] | null = null
    if (q) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          q,
        )
      let profileQuery = gate.admin
        .from("profiles")
        .select("id")
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(80)

      if (isUuid) {
        profileQuery = gate.admin.from("profiles").select("id").eq("id", q)
      }

      const { data: profiles } = await profileQuery
      matchingUserIds = (profiles || []).map((p) => p.id)
      if (matchingUserIds.length === 0) {
        const counts = await countByStatus(gate.admin)
        return NextResponse.json({ requests: [], counts })
      }
    }

    let query = gate.admin
      .from("subscription_requests")
      .select(
        `id, user_id, requested_tier, current_tier, amount_fcfa, status, note, created_at, updated_at, activated_at, activated_by,
         profile:user_id(id, full_name, phone, user_type, subscription_tier)`,
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (status !== "all") {
      query = query.eq("status", status)
    }

    if (tierRaw !== "all") {
      const tier = normalizeSubscriptionTier(tierRaw)
      if (tier !== "free") {
        query = query.eq("requested_tier", tier)
      }
    }

    if (matchingUserIds) {
      query = query.in("user_id", matchingUserIds)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const counts = await countByStatus(gate.admin)

    return NextResponse.json({
      requests: (data || []).map((r) => ({
        ...r,
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
      })),
      counts,
    })
  } catch (err) {
    console.error("[api/admin/subscriptions GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

async function countByStatus(admin: ReturnType<
  typeof import("@/lib/supabase/admin").createAdminClient
>) {
  const statuses = ["pending", "activated", "rejected"] as const
  const counts: Record<string, number> = {
    pending: 0,
    activated: 0,
    rejected: 0,
  }
  await Promise.all(
    statuses.map(async (s) => {
      const { count } = await admin
        .from("subscription_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", s)
      counts[s] = count ?? 0
    }),
  )
  return counts
}

/** POST reject — { request_id, note? } */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("subscriptions")
    if (!gate.isAdmin || !gate.admin || !gate.role || !gate.user) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const body = await request.json().catch(() => null)
    const requestId = String(body?.request_id || "")
    const action = String(body?.action || "reject")
    if (!requestId || action !== "reject") {
      return NextResponse.json(
        { error: "request_id + action=reject requis" },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const { error } = await gate.admin
      .from("subscription_requests")
      .update({
        status: "rejected",
        note: body?.note ? String(body.note).slice(0, 500) : null,
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("status", "pending")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[api/admin/subscriptions POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
