import { type NextRequest, NextResponse } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizeForQuery } from "@/lib/security/validation"
import { normalizeSubscriptionTier } from "@/lib/pricing/service-fee"
import { isSellerRole } from "@/lib/dashboard/routing"

/**
 * POST /api/subscriptions/activate
 * Admin only (section subscriptions) — active un palier après preuve WhatsApp.
 * Body: { request_id } OU { user_id, tier } OU { phone, tier }
 */
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

    const admin = gate.admin
    const body = await request.json().catch(() => null)
    let targetUserId = String(body?.user_id || "")
    let tier = normalizeSubscriptionTier(body?.tier)
    const requestId = String(body?.request_id || "")
    const phoneQ = sanitizeForQuery(String(body?.phone || "").trim())

    if (requestId) {
      const { data: req } = await admin
        .from("subscription_requests")
        .select("id, user_id, requested_tier, status")
        .eq("id", requestId)
        .maybeSingle()
      if (!req) {
        return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
      }
      if (req.status !== "pending") {
        return NextResponse.json(
          { error: "Cette demande n’est plus en attente" },
          { status: 400 },
        )
      }
      targetUserId = req.user_id
      tier = normalizeSubscriptionTier(req.requested_tier)
    } else if (!targetUserId && phoneQ) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, user_type, phone")
        .ilike("phone", `%${phoneQ}%`)
        .limit(5)

      if (!profiles?.length) {
        return NextResponse.json(
          { error: "Aucun compte pour ce téléphone" },
          { status: 404 },
        )
      }
      if (profiles.length > 1) {
        return NextResponse.json(
          {
            error: "Plusieurs comptes matchent — précisez l’user_id",
            matches: profiles.map((p) => ({
              id: p.id,
              phone: p.phone,
              user_type: p.user_type,
            })),
          },
          { status: 409 },
        )
      }
      targetUserId = profiles[0].id
    }

    if (!targetUserId || tier === "free") {
      return NextResponse.json(
        { error: "user_id|phone + tier (starter|pro|enterprise) requis" },
        { status: 400 },
      )
    }

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, user_type, subscription_tier")
      .eq("id", targetUserId)
      .maybeSingle()

    if (!targetProfile) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
    }

    if (!isSellerRole(targetProfile.user_type)) {
      return NextResponse.json(
        { error: "Les abonnements vendeur concernent producteur / coop uniquement" },
        { status: 400 },
      )
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const expires = new Date(now)
    expires.setDate(expires.getDate() + 30)
    const expiresIso = expires.toISOString()
    const paymentProof =
      body?.payment_proof_url != null
        ? String(body.payment_proof_url).trim().slice(0, 800)
        : body?.whatsapp_note != null
          ? String(body.whatsapp_note).trim().slice(0, 500)
          : null

    const profilePatch: Record<string, unknown> = {
      subscription_tier: tier,
      updated_at: nowIso,
    }
    // Colonnes optionnelles (migrations variables)
    profilePatch.subscription_expires_at = expiresIso

    const { error: updErr } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", targetUserId)

    if (updErr) {
      // Retry sans expires si colonne absente
      const { error: retryErr } = await admin
        .from("profiles")
        .update({ subscription_tier: tier, updated_at: nowIso })
        .eq("id", targetUserId)
      if (retryErr) {
        console.error("[api/subscriptions/activate] profile", retryErr.message)
        return NextResponse.json({ error: "Activation impossible" }, { status: 500 })
      }
    }

    const reqPatch: Record<string, unknown> = {
      status: "activated",
      activated_at: nowIso,
      activated_by: gate.user.id,
      updated_at: nowIso,
    }
    if (paymentProof) reqPatch.admin_notes = paymentProof

    if (requestId) {
      await admin.from("subscription_requests").update(reqPatch).eq("id", requestId)
    } else {
      await admin
        .from("subscription_requests")
        .update(reqPatch)
        .eq("user_id", targetUserId)
        .eq("requested_tier", tier)
        .eq("status", "pending")
    }

    await admin.from("notifications").insert({
      user_id: targetUserId,
      type: "alert",
      title: "Abonnement activé",
      message: `Ton palier ${tier} est actif jusqu’au ${expires.toLocaleDateString("fr-FR")}.`,
      body: `Abonnement ${tier} activé`,
      link: "/abonnement",
      is_read: false,
      read: false,
    })

    return NextResponse.json({
      success: true,
      user_id: targetUserId,
      tier,
      previous_tier: targetProfile.subscription_tier,
      expires_at: expiresIso,
      payment_proof_saved: !!paymentProof,
    })
  } catch (err) {
    console.error("[api/subscriptions/activate]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
