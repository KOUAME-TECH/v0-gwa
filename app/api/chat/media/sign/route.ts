import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  CHAT_MEDIA_BUCKET,
  CHAT_SIGNED_URL_TTL_SEC,
  extractChatStoragePath,
  isChatStoragePath,
} from "@/lib/chat/upload"
import { z } from "zod"

export const dynamic = "force-dynamic"

const signSchema = z.object({
  path: z.string().min(8).max(400),
  conversationId: z.string().uuid().optional(),
})

/**
 * POST /api/chat/media/sign
 * Lien signé pour un média chat — participants only.
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("CHAT_UPLOAD")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de demandes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Reconnecte-toi" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = signSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Chemin invalide" }, { status: 400 })
    }

    const path =
      extractChatStoragePath(parsed.data.path) ||
      (isChatStoragePath(parsed.data.path) ? parsed.data.path : null)
    if (!path) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 400 })
    }

    const parts = path.split("/")
    const ownerId = parts[0]
    const conversationId = parsed.data.conversationId || parts[1]
    if (!conversationId || !/^[0-9a-f-]{36}$/i.test(conversationId)) {
      return NextResponse.json({ error: "Conversation invalide" }, { status: 400 })
    }

    const { data: conv } = await supabase
      .from("conversations")
      .select("id, participant_1, participant_2")
      .eq("id", conversationId)
      .maybeSingle()

    if (
      !conv ||
      (conv.participant_1 !== user.id && conv.participant_2 !== user.id)
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    // Le path doit appartenir à un participant (anti-énumération)
    if (
      ownerId !== conv.participant_1 &&
      ownerId !== conv.participant_2
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const { data, error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .createSignedUrl(path, CHAT_SIGNED_URL_TTL_SEC)

    if (error || !data?.signedUrl) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path)
      return NextResponse.json({
        url: publicUrl,
        expiresIn: null,
        fallback: "public",
      })
    }

    return NextResponse.json({
      url: data.signedUrl,
      expiresIn: CHAT_SIGNED_URL_TTL_SEC,
      path,
    })
  } catch (err) {
    console.error("[chat/media/sign]", err)
    return NextResponse.json({ error: "Lien impossible" }, { status: 500 })
  }
}
