import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-admin"
import { sendPushToUser } from "@/lib/notifications/push"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizePlainText } from "@/lib/security/validation"

/**
 * POST /api/messages/notify
 * Après envoi d'un message : notif DB + push OneSignal au destinataire.
 */
export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit("MESSAGE_SEND")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de messages" }, { status: 429 })
    }

    const gate = await requireUser()
    if (!gate.user) {
      return NextResponse.json(
        { error: gate.error || "Non authentifié" },
        { status: gate.suspended ? 403 : 401 },
      )
    }
    const user = gate.user
    const supabase = gate.supabase

    const body = await request.json()
    const conversationId = String(body?.conversation_id || "")
    const preview = sanitizePlainText(
      String(body?.preview || "Nouveau message"),
      120,
    )

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversation_id requis" },
        { status: 400 },
      )
    }

    const { data: conv } = await supabase
      .from("conversations")
      .select("id, participant_1, participant_2")
      .eq("id", conversationId)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation introuvable" },
        { status: 404 },
      )
    }

    // Best-effort : s'assurer qu'un message récent de l'émetteur existe dans la conv
    try {
      const { data: latest, error: msgErr } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!msgErr && !latest) {
        return NextResponse.json(
          { error: "Aucun message de l'émetteur dans cette conversation" },
          { status: 400 },
        )
      }
    } catch {
      // non bloquant si la vérif échoue techniquement
    }

    const recipientId =
      conv.participant_1 === user.id
        ? conv.participant_2
        : conv.participant_2 === user.id
          ? conv.participant_1
          : null

    if (!recipientId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const { data: sender } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()

    const title = sender?.full_name
      ? `Message de ${sender.full_name}`
      : "Nouveau message GWA"

    // La page /messages ouvre une conversation via ?to=<id de l'autre utilisateur>.
    // Pour le destinataire, "l'autre" est l'expéditeur (user.id).
    const openLink = `/messages?to=${user.id}`

    await supabase.from("notifications").insert({
      user_id: recipientId,
      type: "message",
      title,
      message: preview,
      body: preview,
      link: openLink,
      is_read: false,
      read: false,
    })

    const push = await sendPushToUser(supabase as never, recipientId, {
      title,
      body: preview,
      url: openLink,
      data: { conversation_id: conversationId },
    })

    return NextResponse.json({
      success: true,
      push_sent: push.success,
    })
  } catch (err) {
    console.error("[api/messages/notify]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
