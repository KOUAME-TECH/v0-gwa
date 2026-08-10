import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth/require-admin"
import { parseOfferContent, type OfferStatus } from "@/lib/chat/offer"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * POST /api/offers/respond
 * Accepte / refuse une offre chat — côté serveur uniquement.
 * Body: { message_id, action: "accepted" | "declined" }
 *
 * Anti-hack : l'offreur ne peut pas s'auto-accepter (accepted_by ≠ sender).
 */
export async function POST(request: Request) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user

    const body = await request.json().catch(() => ({}))
    const messageId = String(body.message_id || "")
    const action = String(body.action || "") as OfferStatus
    if (!messageId || (action !== "accepted" && action !== "declined")) {
      return NextResponse.json(
        { error: "message_id et action (accepted|declined) requis" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, content, message_type")
      .eq("id", messageId)
      .maybeSingle()

    if (msgErr || !msg || msg.message_type !== "offer") {
      return NextResponse.json({ error: "Offre introuvable" }, { status: 404 })
    }

    if (msg.sender_id === user.id) {
      return NextResponse.json(
        { error: "Tu ne peux pas répondre à ta propre offre", code: "SELF_RESPOND" },
        { status: 403 },
      )
    }

    const { data: conv } = await admin
      .from("conversations")
      .select("id, participant_1, participant_2")
      .eq("id", msg.conversation_id)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 })
    }

    const participants = [conv.participant_1, conv.participant_2]
    if (!participants.includes(user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const offer = parseOfferContent(msg.content)
    if (!offer) {
      return NextResponse.json({ error: "Offre invalide" }, { status: 400 })
    }
    if (offer.status !== "pending") {
      return NextResponse.json(
        { error: "Cette offre a déjà été traitée", status: offer.status },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()
    const next =
      action === "accepted"
        ? {
            ...offer,
            status: "accepted" as const,
            accepted_by: user.id,
            accepted_at: now,
          }
        : {
            ...offer,
            status: "declined" as const,
            declined_by: user.id,
            declined_at: now,
          }

    const content = JSON.stringify(next)
    const { error: updErr } = await admin
      .from("messages")
      .update({ content, is_edited: true })
      .eq("id", messageId)
      .eq("sender_id", msg.sender_id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    const replyText =
      action === "accepted"
        ? `J'accepte l'offre de ${Math.round(offer.amount).toLocaleString("fr-FR")} FCFA`
        : `Je refuse l'offre de ${Math.round(offer.amount).toLocaleString("fr-FR")} FCFA`

    await admin.from("messages").insert({
      conversation_id: msg.conversation_id,
      sender_id: user.id,
      content: replyText,
      message_type: "text",
      reply_to_id: messageId,
    })

    return NextResponse.json({
      success: true,
      action,
      offer: next,
      content,
    })
  } catch (err) {
    console.error("[offers/respond]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
