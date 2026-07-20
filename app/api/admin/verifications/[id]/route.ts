import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/verifications/[id]
 * Approuve / refuse une demande de vérification (KYC) — service role + admin actif.
 * Remplace les écritures privilégiées côté client.
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdmin()
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || "")
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action requise: approve|reject" }, { status: 400 })
    }

    const { data: req } = await gate.admin
      .from("verification_requests")
      .select("id, user_id, cooperative_id, request_type, status")
      .eq("id", id)
      .maybeSingle()

    if (!req) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const approved = action === "approve"

    const { error: upErr } = await gate.admin
      .from("verification_requests")
      .update({
        status: approved ? "approved" : "rejected",
        notes: body?.notes ? String(body.notes).slice(0, 1000) : null,
        reviewed_at: now,
        reviewed_by: gate.user.id,
        updated_at: now,
      })
      .eq("id", id)

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    if (approved) {
      if (req.request_type === "profile" || req.request_type === "certification") {
        await gate.admin.from("profiles").update({ is_verified: true }).eq("id", req.user_id)
      } else if (req.request_type === "cooperative" && req.cooperative_id) {
        await gate.admin
          .from("cooperatives")
          .update({ is_verified: true, verification_date: now })
          .eq("id", req.cooperative_id)
      }
    }

    await gate.admin.from("notifications").insert({
      user_id: req.user_id,
      type: "verification",
      title: approved ? "Vérification approuvée" : "Vérification refusée",
      message: approved
        ? "Votre demande de vérification a été approuvée. Votre profil est maintenant vérifié."
        : `Votre demande de vérification a été refusée.${body?.notes ? ` Raison : ${String(body.notes).slice(0, 300)}` : ""}`,
      body: approved ? "Vérification approuvée" : "Vérification refusée",
      link: "/profil",
      is_read: false,
      read: false,
    })

    return NextResponse.json({ success: true, status: approved ? "approved" : "rejected" })
  } catch (err) {
    console.error("[api/admin/verifications]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
