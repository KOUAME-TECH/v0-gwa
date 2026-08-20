import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"

type Ctx = { params: Promise<{ id: string }> }

const ALLOWED = new Set(["open", "under_review", "resolved", "closed"])
const ESCROW_OUTCOMES = new Set(["release_seller", "refund_buyer", "keep_frozen"])

/**
 * PATCH /api/admin/disputes/[id]
 * Body: { status, resolution?, refund_amount?, escrow_outcome? }
 * escrow_outcome (si resolved/closed) : release_seller | refund_buyer | keep_frozen
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("disputes")
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const status = String(body?.status || "")
    const resolution =
      body?.resolution != null ? String(body.resolution).slice(0, 2000) : null
    const refundRaw = body?.refund_amount
    const refundAmount =
      refundRaw === "" || refundRaw == null ? null : Number(refundRaw)
    const escrowOutcomeRaw = body?.escrow_outcome
      ? String(body.escrow_outcome)
      : null

    if (!ALLOWED.has(status)) {
      return NextResponse.json(
        { error: "status invalide (open|under_review|resolved|closed)" },
        { status: 400 },
      )
    }

    if (
      escrowOutcomeRaw &&
      !ESCROW_OUTCOMES.has(escrowOutcomeRaw)
    ) {
      return NextResponse.json(
        {
          error:
            "escrow_outcome invalide (release_seller|refund_buyer|keep_frozen)",
        },
        { status: 400 },
      )
    }

    const { data: existing, error: findErr } = await gate.admin
      .from("disputes")
      .select("id, status, opened_by, assigned_to, order_id")
      .eq("id", id)
      .maybeSingle()

    if (findErr || !existing) {
      return NextResponse.json({ error: "Litige introuvable" }, { status: 404 })
    }

    if (
      existing.status === status &&
      (resolution == null || resolution === "") &&
      refundAmount == null &&
      !escrowOutcomeRaw
    ) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        dispute: existing,
      })
    }

    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status,
      updated_at: now,
    }

    if (status === "resolved" || status === "closed") {
      updates.resolved_at = now
      if (resolution) updates.resolution = resolution
      if (refundAmount != null && !Number.isNaN(refundAmount)) {
        updates.refund_amount = refundAmount
      }
    }

    if (status === "under_review" && !existing.assigned_to) {
      updates.assigned_to = gate.user.id
    }

    const { data, error } = await gate.admin
      .from("disputes")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let escrowApplied: string | null = null

    if (
      (status === "resolved" || status === "closed") &&
      existing.order_id &&
      escrowOutcomeRaw
    ) {
      const { data: order } = await gate.admin
        .from("orders")
        .select("id, order_number, buyer_id, seller_id, escrow_status, status")
        .eq("id", existing.order_id)
        .maybeSingle()

      if (order) {
        if (escrowOutcomeRaw === "release_seller") {
          // Crédit Wallet uniquement — PAS de double payout confirm.
          // payout_status=credited_wallet → entre dans le solde withdraw.
          await gate.admin
            .from("orders")
            .update({
              status: "delivered",
              escrow_status: "released",
              payout_status: "credited_wallet",
              payout_error: null,
              updated_at: now,
            })
            .eq("id", order.id)
            .in("escrow_status", ["held", "frozen"])
          await gate.admin
            .from("escrow_transactions")
            .update({ status: "released", released_at: now })
            .eq("order_id", order.id)
            .in("status", ["held", "frozen"])
          escrowApplied = "release_seller"
          await gate.admin.from("notifications").insert({
            user_id: order.seller_id,
            type: "order",
            title: "Litige résolu — fonds au Wallet",
            message: `Solde crédité pour ${order.order_number} — retire depuis Wallet`,
            link: "/wallet",
            is_read: false,
            read: false,
          })
          void sendPushToUser(gate.admin as never, order.seller_id, {
            title: "Litige résolu",
            body: `${order.order_number} — fonds au Wallet`,
            url: "/wallet",
          })
        } else if (escrowOutcomeRaw === "refund_buyer") {
          // Flag ops — remboursement PSP manuel / file finances (pas un cash auto)
          await gate.admin
            .from("orders")
            .update({
              status: "cancelled",
              escrow_status: "released",
              payment_status: "refunded",
              payout_status: "refund_ops",
              payout_error: "REFUND_PENDING_OPS",
              updated_at: now,
            })
            .eq("id", order.id)
            .in("escrow_status", ["held", "frozen"])
          await gate.admin
            .from("escrow_transactions")
            .update({ status: "refunded", released_at: now })
            .eq("order_id", order.id)
            .in("status", ["held", "frozen"])
          escrowApplied = "refund_buyer"
          await gate.admin.from("notifications").insert({
            user_id: order.buyer_id,
            type: "order",
            title: "Litige résolu — remboursement en cours",
            message: `Remboursement en file ops pour ${order.order_number}`,
            link: "/dashboard/commandes",
            is_read: false,
            read: false,
          })
          void sendPushToUser(gate.admin as never, order.buyer_id, {
            title: "Litige résolu",
            body: `${order.order_number} — remboursement en cours`,
            url: "/dashboard/commandes",
          })
        } else {
          // keep_frozen — dossier clos côté litige, fonds restent gelés pour suivi manuel
          escrowApplied = "keep_frozen"
        }

        await gate.admin.from("order_audit_log").insert({
          order_id: order.id,
          performed_by: gate.user.id,
          action: "dispute_resolved",
          new_value: escrowOutcomeRaw,
          notes: (resolution || "").slice(0, 500),
        })
      }
    }

    if (existing.opened_by) {
      await gate.admin.from("notifications").insert({
        user_id: existing.opened_by,
        type: "dispute",
        title: `Litige ${status === "resolved" ? "résolu" : "mis à jour"}`,
        message:
          resolution ||
          `Le statut de votre litige a été mis à jour : ${status}`,
        link: "/dashboard/commandes",
      })
    }

    return NextResponse.json({
      success: true,
      idempotent: existing.status === status,
      dispute: data,
      escrowApplied,
    })
  } catch (err) {
    console.error("[api/admin/disputes/id]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
