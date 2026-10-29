import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { parseOfferContent } from "@/lib/chat/offer"

const responseSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(["accepted", "declined", "countered"]),
})

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request)
  if (csrf) return csrf

  const rate = await checkRateLimit("API_CREATE")
  if (!rate.success) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const parsed = responseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Réponse invalide" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: message } = await admin
    .from("messages")
    .select("id, conversation_id, sender_id, content, message_type")
    .eq("id", parsed.data.messageId)
    .maybeSingle()

  const offer = message?.message_type === "offer"
    ? parseOfferContent(message.content)
    : null
  if (!message || !offer) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 })
  }
  if (offer.status !== "pending") {
    return NextResponse.json({ error: "Cette offre n'est plus en attente" }, { status: 409 })
  }

  const { data: conversation } = await admin
    .from("conversations")
    .select("participant_1, participant_2")
    .eq("id", message.conversation_id)
    .maybeSingle()

  if (
    !conversation ||
    ![conversation.participant_1, conversation.participant_2].includes(user.id) ||
    message.sender_id === user.id
  ) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const status = parsed.data.status
  const content = JSON.stringify({ ...offer, status })
  const { data: updated, error } = await admin
    .from("messages")
    .update({
      content,
      is_edited: true,
      offer_accepted_by: status === "accepted" ? user.id : null,
    })
    .eq("id", message.id)
    .eq("content", message.content)
    .select("*")
    .maybeSingle()

  if (error) {
    console.error("[messages/offer-response]", error.message)
    return NextResponse.json({ error: "Mise à jour impossible" }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: "Cette offre vient d'être modifiée" }, { status: 409 })
  }

  return NextResponse.json({ message: updated })
}
