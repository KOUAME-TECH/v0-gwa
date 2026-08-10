import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  FACTORING_MIN_SCORE,
  isFactoringEligible,
  roleCanRequestFactoring,
} from "@/lib/factoring/eligibility"
import { factoringQueuePriority } from "@/lib/pricing/entitlements"
import {
  canUseAdvancedCoopFeatures,
  evaluateCoopQualification,
  countActiveMembers,
  hasLegalDocuments,
} from "@/lib/cooperatives/validation-policy"

/** Seuil d'éligibilité affacturage (aligné sur bancable du moteur SCG) */
const SCG_SEUIL_ELIGIBILITE = FACTORING_MIN_SCORE

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
          "*, requester:requester_id (id, full_name, phone, city, user_type, scg_score, scg_badge, scg_bancable, subscription_tier)",
        )
        .order("created_at", { ascending: false })
        .limit(200)
      if (qErr) {
        return NextResponse.json({ error: qErr.message }, { status: 500 })
      }
      const sorted = [...(data ?? [])].sort((a, b) => {
        const pa = Number((a as { queue_priority?: number }).queue_priority) || 0
        const pb = Number((b as { queue_priority?: number }).queue_priority) || 0
        if (pb !== pa) return pb - pa
        return (
          Date.parse(String(a.created_at)) - Date.parse(String(b.created_at))
        )
      })
      return NextResponse.json({ requests: sorted, is_admin: true })
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
    // Plafond absolu bas — le plafond créances est appliqué après éligibilité
    if (amount > 50_000_000) {
      return NextResponse.json({ error: "Montant trop élevé" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Profil + snapshot SCG au moment de la demande
    const { data: profile } = await admin
      .from("profiles")
      .select(
        "id, user_type, scg_score, scg_badge, scg_bancable, subscription_tier, coop_id",
      )
      .eq("id", user.id)
      .maybeSingle()

    if (!roleCanRequestFactoring(profile?.user_type)) {
      return NextResponse.json(
        {
          error:
            "Seuls les producteurs et coopératives peuvent demander de l'affacturage.",
          code: "ROLE_NOT_ELIGIBLE",
          user_type: profile?.user_type ?? null,
        },
        { status: 403 },
      )
    }

    // Coop restricted → pas d'affacturage (feature avancée)
    if (profile?.user_type === "cooperative" && profile.coop_id) {
      const { data: coop } = await admin
        .from("cooperatives")
        .select("id, created_at, legal_documents, registration_number, validation_status")
        .eq("id", profile.coop_id)
        .maybeSingle()
      if (coop) {
        const { data: members } = await admin
          .from("cooperative_members")
          .select("is_active")
          .eq("cooperative_id", coop.id)
        const access = evaluateCoopQualification({
          createdAt: coop.created_at,
          activeMemberCount: countActiveMembers(members),
          hasLegalDocs: hasLegalDocuments(
            coop.legal_documents,
            coop.registration_number,
          ),
          adminStatus: coop.validation_status,
        }).access
        if (!canUseAdvancedCoopFeatures(access)) {
          return NextResponse.json(
            {
              error:
                "Affacturage réservé aux coopératives qualifiées (membres + docs). Fonctions de base restent ouvertes.",
              code: "COOP_ADVANCED_RESTRICTED",
              access,
            },
            { status: 403 },
          )
        }
      }
    }

    const score = profile?.scg_score ?? 0
    const eligible = isFactoringEligible({
      scg_bancable: profile?.scg_bancable,
      scg_score: score,
    })

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

    // Plafond = créances held non déjà payées — hors litige, hors avances déjà demandées
    const { data: receivableOrders } = await admin
      .from("orders")
      .select(
        "id, vendeur_recoit_fcfa, total_amount, commission_fcfa, service_fee, escrow_status, payout_status",
      )
      .eq("seller_id", user.id)
      .eq("payment_status", "paid")
      .eq("escrow_status", "held")
    const eligibleOrders = (receivableOrders || []).filter((o) => {
      const ps = o.payout_status
      return ps == null || !["paid", "skipped_sim", "processing"].includes(String(ps))
    })
    const maxReceivable = eligibleOrders.reduce((s, o) => {
      if (o.vendeur_recoit_fcfa != null) return s + (Number(o.vendeur_recoit_fcfa) || 0)
      return (
        s +
        Math.max(
          0,
          (Number(o.total_amount) || 0) -
            (Number(o.commission_fcfa) || 0) -
            (Number(o.service_fee) || 0),
        )
      )
    }, 0)

    const { data: openReq } = await admin
      .from("factoring_requests")
      .select("amount_fcfa, approved_amount_fcfa, status, order_id")
      .eq("requester_id", user.id)
      .in("status", ["pending", "approved", "disbursed"])

    const reserved = (openReq || []).reduce(
      (s, r) =>
        s + Math.round(Number(r.approved_amount_fcfa ?? r.amount_fcfa) || 0),
      0,
    )
    const cap = Math.max(0, Math.round(maxReceivable) - reserved)
    if (cap <= 0) {
      return NextResponse.json(
        {
          error:
            "Aucune créance éligible pour une avance. Il faut des ventes payées encore gardées.",
          code: "NO_RECEIVABLES",
        },
        { status: 400 },
      )
    }
    if (amount > cap) {
      return NextResponse.json(
        {
          error: `Montant plafonné à ${cap.toLocaleString("fr-FR")} FCFA (créances disponibles)`,
          code: "AMOUNT_ABOVE_RECEIVABLES",
          max_fcfa: cap,
        },
        { status: 400 },
      )
    }

    const queuePriority = factoringQueuePriority(profile?.subscription_tier)

    // order_id optionnel : doit appartenir au demandeur vendeur
    if (orderId) {
      const { data: order } = await admin
        .from("orders")
        .select("id, buyer_id, seller_id, payment_status, escrow_status, payout_status")
        .eq("id", orderId)
        .maybeSingle()
      if (!order || order.seller_id !== user.id) {
        return NextResponse.json(
          { error: "Commande invalide ou non associée à votre compte vendeur" },
          { status: 400 },
        )
      }
      if (order.payment_status !== "paid") {
        return NextResponse.json(
          { error: "La commande liée doit être payée", code: "ORDER_NOT_PAID" },
          { status: 400 },
        )
      }
      if (order.escrow_status !== "held") {
        return NextResponse.json(
          { error: "Cette vente n’a plus d’argent gardé éligible", code: "ORDER_NOT_HELD" },
          { status: 400 },
        )
      }
      const existingOpen = (openReq || []).find(
        (r) =>
          r.order_id === orderId &&
          ["pending", "approved"].includes(String(r.status)),
      )
      if (existingOpen) {
        return NextResponse.json(
          {
            error: "Une avance est déjà en cours pour cette commande",
            code: "FACTORING_ORDER_OPEN",
          },
          { status: 409 },
        )
      }
    }

    const insertBase: Record<string, unknown> = {
      requester_id: user.id,
      order_id: orderId,
      amount_fcfa: amount,
      status: "pending",
      scg_score_snapshot: score,
      scg_badge_snapshot: profile?.scg_badge ?? null,
      queue_priority: queuePriority,
    }

    let { data: created, error: insErr } = await admin
      .from("factoring_requests")
      .insert(insertBase)
      .select()
      .single()

    if (insErr && /queue_priority|column/i.test(insErr.message)) {
      const { queue_priority: _qp, ...withoutPriority } = insertBase
      const fallback = await admin
        .from("factoring_requests")
        .insert(withoutPriority)
        .select()
        .single()
      created = fallback.data
      insErr = fallback.error
    }

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
