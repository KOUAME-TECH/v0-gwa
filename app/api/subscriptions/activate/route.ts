import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { normalizeSubscriptionTier } from "@/lib/pricing/service-fee"

/**
 * POST /api/subscriptions/activate
 * Admin only — active un palier après paiement WhatsApp / preuve.
 * Body: { request_id } OU { user_id, tier }
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: role } = await admin
      .from("admin_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (!role) {
      return NextResponse.json({ error: "Admin requis" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    let targetUserId = String(body?.user_id || "")
    let tier = normalizeSubscriptionTier(body?.tier)
    const requestId = String(body?.request_id || "")

    if (requestId) {
      const { data: req } = await admin
        .from("subscription_requests")
        .select("id, user_id, requested_tier, status")
        .eq("id", requestId)
        .maybeSingle()
      if (!req) {
        return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
      }
      targetUserId = req.user_id
      tier = normalizeSubscriptionTier(req.requested_tier)
    }

    if (!targetUserId || tier === "free") {
      return NextResponse.json(
        { error: "user_id + tier (starter|pro|enterprise) requis" },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const { error: updErr } = await admin
      .from("profiles")
      .update({ subscription_tier: tier, updated_at: now })
      .eq("id", targetUserId)

    if (updErr) {
      console.error("[api/subscriptions/activate] profile", updErr.message)
      return NextResponse.json({ error: "Activation impossible" }, { status: 500 })
    }

    if (requestId) {
      await admin
        .from("subscription_requests")
        .update({
          status: "activated",
          activated_at: now,
          activated_by: user.id,
          updated_at: now,
        })
        .eq("id", requestId)
    } else {
      await admin
        .from("subscription_requests")
        .update({
          status: "activated",
          activated_at: now,
          activated_by: user.id,
          updated_at: now,
        })
        .eq("user_id", targetUserId)
        .eq("requested_tier", tier)
        .eq("status", "pending")
    }

    return NextResponse.json({ success: true, user_id: targetUserId, tier })
  } catch (err) {
    console.error("[api/subscriptions/activate]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
