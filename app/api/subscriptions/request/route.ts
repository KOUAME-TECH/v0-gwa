import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizePlainText } from "@/lib/security/validation"
import {
  normalizeSubscriptionTier,
  SUBSCRIPTION_PRICES_FCFA,
  type SubscriptionTier,
} from "@/lib/pricing/service-fee"
import { isSellerRole } from "@/lib/dashboard/routing"

const REQUESTABLE: SubscriptionTier[] = ["starter", "pro", "enterprise"]

/**
 * POST /api/subscriptions/request
 * Body: { tier: "starter"|"pro"|"enterprise", note? }
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

    const body = await request.json().catch(() => null)
    const tier = normalizeSubscriptionTier(body?.tier)
    if (!REQUESTABLE.includes(tier)) {
      return NextResponse.json(
        { error: "Choisis Starter, Pro ou Entreprise" },
        { status: 400 },
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, user_type, full_name, phone")
      .eq("id", user.id)
      .maybeSingle()

    if (!isSellerRole(profile?.user_type)) {
      return NextResponse.json(
        {
          error:
            "Les abonnements payants sont réservés aux producteurs et coopératives",
        },
        { status: 403 },
      )
    }

    const current = normalizeSubscriptionTier(profile?.subscription_tier)
    if (current === tier) {
      return NextResponse.json(
        { error: "Tu es déjà sur ce palier" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    // Annuler les pending précédents du même user
    await admin
      .from("subscription_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "pending")

    const amount = SUBSCRIPTION_PRICES_FCFA[tier]
    const { data: row, error } = await admin
      .from("subscription_requests")
      .insert({
        user_id: user.id,
        requested_tier: tier,
        current_tier: current,
        amount_fcfa: amount,
        status: "pending",
        note: sanitizePlainText(String(body?.note || ""), 500) || null,
      })
      .select("id, requested_tier, amount_fcfa, status, created_at")
      .single()

    if (error || !row) {
      console.error("[api/subscriptions/request]", error?.message)
      return NextResponse.json(
        { error: "Impossible d’enregistrer la demande" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      request: row,
      profile: {
        full_name: profile?.full_name,
        phone: profile?.phone,
        user_type: profile?.user_type,
      },
    })
  } catch (err) {
    console.error("[api/subscriptions/request]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

/** GET — dernière demande + palier actuel */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, user_type")
      .eq("id", user.id)
      .maybeSingle()

    const { data: latest } = await supabase
      .from("subscription_requests")
      .select("id, requested_tier, amount_fcfa, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      tier: normalizeSubscriptionTier(profile?.subscription_tier),
      user_type: profile?.user_type,
      latestRequest: latest,
    })
  } catch (err) {
    console.error("[api/subscriptions/request GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
