import { NextResponse, type NextRequest } from "next/server"
import { requireAdminSection } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { validateManualPayoutUpdate } from "@/lib/wallet/manual-payout-admin"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdminSection("finances")
    if (!gate.isAdmin || !gate.admin || !gate.user) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const status = String(body?.status || "")
    const reference = String(body?.payout_reference || "").trim()
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 1000) : ""

    const { data: payout, error: payoutError } = await gate.admin
      .from("withdrawal_requests")
      .select("user_id, amount_fcfa, status")
      .eq("id", id)
      .maybeSingle()
    if (payoutError) {
      console.error("[api/admin/payouts PATCH]", payoutError.message)
      return NextResponse.json({ error: "Demande indisponible" }, { status: 500 })
    }
    if (!payout) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })

    const validation = validateManualPayoutUpdate(payout.status, status, reference)
    if (!validation.ok) {
      if (validation.code === "INVALID_STATUS") {
        return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
      }
      if (validation.code === "REFERENCE_REQUIRED") {
        return NextResponse.json(
          { error: "La référence réelle du versement est obligatoire" },
          { status: 400 },
        )
      }
      if (validation.code === "REFERENCE_TOO_LONG") {
        return NextResponse.json(
          { error: "La référence ne peut pas dépasser 128 caractères" },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: "Transition de statut non autorisée" }, { status: 409 })
    }
    if (status === "failed" && !notes) {
      return NextResponse.json({ error: "Indiquez le motif de l’échec" }, { status: 400 })
    }

    // The RPC rechecks this transition under a row lock and remains authoritative during races.
    const { data, error } = await gate.admin.rpc("admin_update_manual_payout", {
      p_request_id: id,
      p_new_status: status,
      p_payout_reference: reference || null,
      p_notes: notes || null,
      p_actor: gate.user.id,
    })
    if (error) {
      if (/admin_update_manual_payout|function .*does not exist/i.test(error.message)) {
        return NextResponse.json(
          { error: "Migration 065 requise pour le traitement manuel", code: "MIGRATION_REQUIRED" },
          { status: 503 },
        )
      }
      if (/not found/i.test(error.message)) {
        return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
      }
      if (/transition/i.test(error.message)) {
        return NextResponse.json({ error: "Transition de statut non autorisée" }, { status: 409 })
      }
      if (/reference required/i.test(error.message)) {
        return NextResponse.json({ error: "Référence de versement requise" }, { status: 400 })
      }
      if (/reference too long/i.test(error.message)) {
        return NextResponse.json({ error: "La référence ne peut pas dépasser 128 caractères" }, { status: 400 })
      }
      if (/finance admin/i.test(error.message)) {
        return NextResponse.json({ error: "Accès finance refusé" }, { status: 403 })
      }
      console.error("[api/admin/payouts PATCH]", error.message)
      return NextResponse.json({ error: "Mise à jour impossible" }, { status: 400 })
    }

    const message =
      status === "paid"
        ? `Votre versement de ${Number(payout.amount_fcfa).toLocaleString("fr-FR")} FCFA a été enregistré.`
        : status === "failed"
          ? `Votre demande de versement a échoué : ${notes}`
          : "Votre demande de versement est en cours de traitement."
    const { error: notificationError } = await gate.admin.from("notifications").insert({
      user_id: payout.user_id,
      type: "order",
      title: status === "paid" ? "Versement effectué" : "Mise à jour du versement",
      message,
      body: message,
      link: "/wallet",
      is_read: false,
      read: false,
    })
    if (notificationError) console.warn("[api/admin/payouts] notification", notificationError.message)

    return NextResponse.json({ payout: data })
  } catch (err) {
    console.error("[api/admin/payouts PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
