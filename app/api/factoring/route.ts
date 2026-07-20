import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/** Seuil d'éligibilité affacturage (aligné sur bancable du moteur SCG) */
const SCG_SEUIL_ELIGIBILITE = 500

/**
 * GET /api/factoring — demandes de l'utilisateur (ou toutes si admin)
 * POST /api/factoring — créer une demande (gate éligibilité SCG) + snapshot SCG
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (!user) {
      return NextResponse.json({ error: error || "Non authentifié" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Admin ? -> file complète
    const { data: adminRole } = await admin
      .from("admin_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    const scope = request.nextUrl.searchParams.get("scope") || "own"

    if (adminRole && scope === "all") {
      const { data, error: qErr } = await admin
        .from("factoring_requests")
        .select(
          "*, requester:requester_id (id, full_name, phone, city, user_type, scg_score, scg_badge, scg_bancable)",
        )
        .order("created_at", { ascending: false })
        .limit(200)
      if (qErr) {
        return NextResponse.json({ error: qErr.message }, { status: 500 })
      }
      return NextResponse.json({ requests: data ?? [], is_admin: true })
    }

    const { data, error: qErr } = await admin
      .from("factoring_requests")
      .select("*")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 })
    }
    return NextResponse.json({ requests: data ?? [], is_admin: !!adminRole })
  } catch (err) {
    console.error("[api/factoring GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const { user, error } = await requireUser()
    if (!user) {
      return NextResponse.json({ error: error || "Non authentifié" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const amount = Number(body?.amount_fcfa)
    const orderId = body?.order_id ? String(body.order_id) : null

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 })
    }
    if (amount > 500_000_000) {
      return NextResponse.json({ error: "Montant trop élevé" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Profil + snapshot SCG au moment de la demande
    const { data: profile } = await admin
      .from("profiles")
      .select("id, scg_score, scg_badge, scg_bancable")
      .eq("id", user.id)
      .maybeSingle()

    const score = profile?.scg_score ?? 0
    const bancable = profile?.scg_bancable ?? false
    const eligible = bancable || score >= SCG_SEUIL_ELIGIBILITE

    if (!eligible) {
      return NextResponse.json(
        {
          error:
            "Profil non éligible à l'affacturage. Un score SCG suffisant (bancable) est requis.",
          code: "SCG_NOT_ELIGIBLE",
          scg_score: score,
          seuil: SCG_SEUIL_ELIGIBILITE,
        },
        { status: 403 },
      )
    }

    // order_id optionnel : doit appartenir au demandeur (vendeur ou acheteur)
    if (orderId) {
      const { data: order } = await admin
        .from("orders")
        .select("id, buyer_id, seller_id")
        .eq("id", orderId)
        .maybeSingle()
      if (!order || (order.seller_id !== user.id && order.buyer_id !== user.id)) {
        return NextResponse.json(
          { error: "Commande invalide ou non associée à votre compte" },
          { status: 400 },
        )
      }
    }

    const { data: created, error: insErr } = await admin
      .from("factoring_requests")
      .insert({
        requester_id: user.id,
        order_id: orderId,
        amount_fcfa: amount,
        status: "pending",
        scg_score_snapshot: score,
        scg_badge_snapshot: profile?.scg_badge ?? null,
      })
      .select()
      .single()

    if (insErr || !created) {
      console.error("[api/factoring POST]", insErr?.message)
      return NextResponse.json(
        { error: insErr?.message || "Création échouée" },
        { status: 400 },
      )
    }

    // Notifier les admins (file d'affacturage)
    const { data: admins } = await admin
      .from("admin_roles")
      .select("user_id")
      .eq("is_active", true)

    if (admins?.length) {
      await admin.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.user_id,
          type: "alert",
          title: "Nouvelle demande d'affacturage",
          message: `Demande de ${Math.round(amount)} FCFA à examiner`,
          body: `Affacturage — ${Math.round(amount)} FCFA`,
          link: "/admin/factoring",
          is_read: false,
          read: false,
        })),
      )
    }

    return NextResponse.json({ request: created }, { status: 201 })
  } catch (err) {
    console.error("[api/factoring POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
