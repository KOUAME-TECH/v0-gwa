import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { yellyChatSchema } from "@/lib/security/validation"
import { askYelly } from "@/lib/yelly/client"
import { loadYellyProductHint, persistYellyTurn } from "@/lib/yelly/context"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/yelly/chat
 * Assistant Yelly — auth + CSRF + rate-limit + zod.
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("YELLY_CHAT")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Yelly est saturée. Réessaie dans une minute." },
        { status: 429 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: "Connecte-toi pour parler à Yelly." },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = yellyChatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Message invalide", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { message, page, context } = parsed.data
    const conversationId =
      typeof body?.conversationId === "string" &&
      /^[0-9a-f-]{36}$/i.test(body.conversationId)
        ? body.conversationId
        : null

    const contextHint = await loadYellyProductHint(supabase, context?.productId)
    const cityHint = context?.city
      ? `Ville utilisateur: ${context.city}`
      : undefined

    const result = await askYelly({
      message,
      page,
      contextHint: [contextHint, cityHint].filter(Boolean).join(" | ") || undefined,
    })

    const savedId = await persistYellyTurn(supabase, {
      userId: user.id,
      conversationId,
      userMessage: message,
      assistantReply: result.reply,
      page,
      source: result.source,
    })

    return NextResponse.json({
      reply: result.reply,
      source: result.source,
      model: result.model,
      conversationId: savedId || conversationId,
      assistant: "Yelly",
    })
  } catch (err) {
    console.error("[api/yelly/chat]", err)
    return NextResponse.json({ error: "Yelly indisponible" }, { status: 500 })
  }
}
