import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  buildChatStoragePath,
  chatMediaPrepareSchema,
  validateChatMedia,
} from "@/lib/chat/upload"

export const dynamic = "force-dynamic"

/**
 * POST /api/chat/media/prepare
 * Rate-limit + Zod + vérif participant → chemin Storage sanitisé.
 * L’upload réel reste côté client (barre de progression XHR).
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("CHAT_UPLOAD")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop d’envois. Attends une minute." },
        { status: 429 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Reconnecte-toi" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = chatMediaPrepareSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Fichier invalide" },
        { status: 400 },
      )
    }

    const { conversationId, kind, mime, size, fileName } = parsed.data
    const check = validateChatMedia({ kind, mime, size })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 })
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

    const path = buildChatStoragePath({
      userId: user.id,
      conversationId,
      mime,
      fileName,
    })

    return NextResponse.json({
      path,
      bucket: "chat-media",
      kind,
      contentType: mime.toLowerCase().split(";")[0].trim(),
    })
  } catch (err) {
    console.error("[chat/media/prepare]", err)
    return NextResponse.json(
      { error: "Préparation impossible" },
      { status: 500 },
    )
  }
}
