import { type NextRequest, NextResponse } from "next/server"
import { requireAdminAction } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

type Ctx = { params: Promise<{ id: string }> }

const STATUS_BY_ACTION: Record<string, "approved" | "rejected" | "disbursed"> = {
  approve: "approved",
  reject: "rejected",
  disburse: "disbursed",
}

/**
 * PATCH /api/admin/factoring/[id]
 * Décision admin (approve / reject / disburse) + notes — service role + admin actif.
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || "")
    const newStatus = STATUS_BY_ACTION[action]

    const actionKey =
      action === "approve"
        ? "factoring_approve"
        : action === "reject"
          ? "factoring_reject"
          : action === "disburse"
            ? "factoring_disburse"
            : null

    if (!actionKey) {
      return NextResponse.json(
        { error: "action requise: approve|reject|disburse" },
        { status: 400 },
      )
    }

    const gate = await requireAdminAction(actionKey)
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    if (!newStatus) {
      return NextResponse.json(
        { error: "action requise: approve|reject|disburse" },
        { status: 400 },
      )
    }

    const { data: existing } = await gate.admin
      .from("factoring_requests")
      .select("id, requester_id, amount_fcfa, status")
      .eq("id", id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
    }

    // Décaissement seulement après approbation
    if (newStatus === "disbursed" && existing.status !== "approved") {
      return NextResponse.json(
        { error: "La demande doit être approuvée avant décaissement" },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const approvedAmount =
      body?.approved_amount_fcfa != null
        ? Math.round(Number(body.approved_amount_fcfa))
        : null
    const feeFcfa =
      body?.fee_fcfa != null ? Math.round(Number(body.fee_fcfa)) : null
    const externalRef =
      body?.external_ref != null
        ? String(body.external_ref).trim().slice(0, 200)
        : null

    if (newStatus === "disbursed" && !externalRef) {
      return NextResponse.json(
        {
          error:
            "external_ref requis pour le décaissement (réf. WhatsApp / virement / MM hors plateforme)",
          code: "EXTERNAL_REF_REQUIRED",
        },
        { status: 400 },
      )
    }

    const patch: Record<string, unknown> = {
      status: newStatus,
      admin_notes: body?.notes ? String(body.notes).slice(0, 1000) : null,
      decided_by: gate.user.id,
      decided_at: now,
    }
    if (approvedAmount != null && Number.isFinite(approvedAmount)) {
      patch.approved_amount_fcfa = approvedAmount
    }
    if (feeFcfa != null && Number.isFinite(feeFcfa)) {
      patch.fee_fcfa = feeFcfa
    }
    if (externalRef) {
      patch.external_ref = externalRef
      patch.disbursed_at = now
    }

    const { data, error } = await gate.admin
      .from("factoring_requests")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      // Retry minimal si colonnes audit absentes
      const { data: fallback, error: err2 } = await gate.admin
        .from("factoring_requests")
        .update({
          status: newStatus,
          admin_notes: body?.notes ? String(body.notes).slice(0, 1000) : null,
          decided_by: gate.user.id,
          decided_at: now,
        })
        .eq("id", id)
        .select()
        .single()
      if (err2) {
        return NextResponse.json({ error: err2.message }, { status: 400 })
      }
      return NextResponse.json({
        request: fallback,
        warning: "Colonnes audit avancées absentes — statut mis à jour seulement",
      })
    }

    const labels: Record<string, string> = {
      approved: "approuvée",
      rejected: "refusée",
      disbursed: "décaissée (hors plateforme)",
    }
    const amountNote =
      approvedAmount != null
        ? ` Montant retenu : ${approvedAmount.toLocaleString("fr-FR")} FCFA.`
        : ""
    await gate.admin.from("notifications").insert({
      user_id: existing.requester_id,
      type: "alert",
      title: "Mise à jour affacturage",
      message: `Votre demande d'affacturage a été ${labels[newStatus]}.${amountNote}`,
      body: `Affacturage ${labels[newStatus]}`,
      link: "/affacturage",
      is_read: false,
      read: false,
    })

    return NextResponse.json({
      request: data,
      note:
        newStatus === "disbursed"
          ? "Décaissement manuel hors GWA — aucun payout FeexPay automatique"
          : undefined,
    })
  } catch (err) {
    console.error("[api/admin/factoring]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
