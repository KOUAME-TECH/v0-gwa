import { type NextRequest, NextResponse } from "next/server"
import { requireAdminAction } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sendPushToUser } from "@/lib/notifications/push"

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/verifications/[id]
 * Approuve / refuse une demande KYC + notifie l'utilisateur (in-app + push).
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 })
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || "")
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Choisissez approuver ou refuser." },
        { status: 400 },
      )
    }

    const gate = await requireAdminAction(
      action === "approve" ? "verification_approve" : "verification_reject",
    )
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const { data: req } = await gate.admin
      .from("verification_requests")
      .select("id, user_id, cooperative_id, request_type, status")
      .eq("id", id)
      .maybeSingle()

    if (!req) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 })
    }

    const now = new Date().toISOString()
    const approved = action === "approve"
    const notes = body?.notes ? String(body.notes).slice(0, 1000) : null

    const { error: upErr } = await gate.admin
      .from("verification_requests")
      .update({
        status: approved ? "approved" : "rejected",
        notes,
        reviewed_at: now,
        reviewed_by: gate.user.id,
        updated_at: now,
      })
      .eq("id", id)

    if (upErr) {
      return NextResponse.json(
        { error: "Mise à jour impossible. Réessayez." },
        { status: 400 },
      )
    }

    // Profil utilisateur (KYC) — request_type "user" (et anciens alias)
    if (approved) {
      const userTypes = new Set(["user", "profile", "certification"])
      if (userTypes.has(String(req.request_type || ""))) {
        await gate.admin.from("profiles").update({ is_verified: true }).eq("id", req.user_id)
      } else if (req.request_type === "cooperative" && req.cooperative_id) {
        await gate.admin
          .from("cooperatives")
          .update({ is_verified: true, verification_date: now })
          .eq("id", req.cooperative_id)
      }
    }

    const title = approved
      ? "Bonne nouvelle — identité vérifiée"
      : "Votre vérification n'a pas abouti"
    const message = approved
      ? "GWA a validé votre pièce d'identité. Votre profil est maintenant vérifié ✓"
      : notes
        ? `GWA n'a pas pu valider votre demande. Motif : ${notes.slice(0, 280)}`
        : "GWA n'a pas pu valider votre demande. Vous pouvez renvoyer vos documents depuis votre profil."

    const { error: notifErr } = await gate.admin.from("notifications").insert({
      user_id: req.user_id,
      type: "verification",
      title,
      message,
      body: message,
      link: "/profil/verification",
      is_read: false,
      read: false,
      data: {
        type: "verification",
        status: approved ? "approved" : "rejected",
        request_id: req.id,
      },
    })

    if (notifErr) {
      // Fallback type system si contrainte ancienne
      console.warn("[verifications] notif", notifErr.message)
      await gate.admin.from("notifications").insert({
        user_id: req.user_id,
        type: "system",
        title,
        message,
        body: message,
        link: "/profil/verification",
        is_read: false,
        read: false,
      })
    }

    await sendPushToUser(gate.admin as never, req.user_id, {
      title,
      body: message,
      url: "/profil/verification",
      data: { type: "verification", status: approved ? "approved" : "rejected" },
    })

    return NextResponse.json({ success: true, status: approved ? "approved" : "rejected" })
  } catch (err) {
    console.error("[api/admin/verifications]", err)
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 })
  }
}
