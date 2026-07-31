import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  canUseYellyToday,
  YELLY_GUEST_MAX_PER_DAY,
} from "@/lib/pricing/entitlements"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { yellyChatSchema } from "@/lib/security/validation"
import { askYelly } from "@/lib/yelly/client"
import {
  countYellyUserMessagesToday,
  loadYellyProductHint,
  persistYellyTurn,
} from "@/lib/yelly/context"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const GUEST_COOKIE = "yelly_guest_n"

function readGuestCount(request: NextRequest): number {
  const raw = request.cookies.get(GUEST_COOKIE)?.value
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

/**
 * POST /api/yelly/chat
 * Auth (quota / jour selon palier abo) OU guest (max 3 / 24h cookie)
 * + CSRF + rate-limit IP + zod.
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

    const guestUsed = readGuestCount(request)
    if (!user && guestUsed >= YELLY_GUEST_MAX_PER_DAY) {
      return NextResponse.json(
        {
          error: "Limite invitée atteinte — connecte-toi pour continuer.",
          guestRemaining: 0,
          reply:
            "Tu as utilisé tes 3 questions gratuites. Connecte-toi pour continuer avec moi, ou WhatsApp +225 07 88 32 60 19.",
        },
        { status: 401 },
      )
    }

    let tier: string | null = "free"
    let yellyRemaining: number | null = null
    let yellyLimit: number | null = null

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .maybeSingle()
      tier = profile?.subscription_tier ?? "free"
      const usedToday = await countYellyUserMessagesToday(supabase, user.id, new Date(), {
        pageNeq: "admin-assist",
      })
      const quota = canUseYellyToday(tier, usedToday)
      yellyLimit = quota.limit
      yellyRemaining = quota.remaining
      if (!quota.ok) {
        return NextResponse.json(
          {
            error: quota.message,
            code: quota.code,
            yellyLimit: quota.limit,
            yellyRemaining: 0,
            reply:
              quota.message ||
              "Limite Yelly du jour atteinte. Reviens demain ou upgrade ton abo.",
          },
          { status: 429 },
        )
      }
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

    let savedId: string | null = conversationId
    if (user) {
      savedId = await persistYellyTurn(supabase, {
        userId: user.id,
        conversationId,
        userMessage: message,
        assistantReply: result.reply,
        page,
        source: result.source,
      })
      if (yellyRemaining != null) {
        yellyRemaining = Math.max(0, yellyRemaining - 1)
      }
    }

    const guestRemaining = user
      ? null
      : Math.max(0, YELLY_GUEST_MAX_PER_DAY - (guestUsed + 1))

    const res = NextResponse.json({
      reply: result.reply,
      source: result.source,
      model: result.model,
      conversationId: savedId || conversationId,
      assistant: "Yelly",
      guestRemaining,
      yellyLimit,
      yellyRemaining,
      resolved: /merci|c.?est bon|parfait|compris/i.test(message),
    })

    if (!user) {
      res.cookies.set(GUEST_COOKIE, String(guestUsed + 1), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24,
      })
    }

    return res
  } catch (err) {
    console.error("[api/yelly/chat]", err)
    return NextResponse.json({ error: "Yelly indisponible" }, { status: 500 })
  }
}
