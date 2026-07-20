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
    const { data, error } = await gate.admin
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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const labels: Record<string, string> = {
      approved: "approuvée",
      rejected: "refusée",
      disbursed: "décaissée",
    }
    await gate.admin.from("notifications").insert({
      user_id: existing.requester_id,
      type: "alert",
      title: "Mise à jour affacturage",
      message: `Votre demande d'affacturage a été ${labels[newStatus]}.`,
      body: `Affacturage ${labels[newStatus]}`,
      link: "/affacturage",
      is_read: false,
      read: false,
    })

    return NextResponse.json({ request: data })
  } catch (err) {
    console.error("[api/admin/factoring]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
