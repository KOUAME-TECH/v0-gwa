import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  canUseYellyToday,
  YELLY_GUEST_MAX_PER_DAY,
} from "@/lib/pricing/entitlements"
import { assertSameOrigin } from "@/lib/security/csrf"
import { yellyChatSchema } from "@/lib/security/validation"
import { askYelly } from "@/lib/yelly/client"
import {
  countYellyUserMessagesToday,
  loadChatTurnsForYelly,
  loadYellyProductContext,
  persistYellyTurn,
} from "@/lib/yelly/context"
import { buildYellyContext, buildYellyTaskInstruction } from "@/lib/yelly/context-builder"
import { deterministicCapabilityReply, detectYellyIntent } from "@/lib/yelly/capabilities"
import {
  genericCacheKey,
  matchFaq,
  readCachedReply,
  writeCachedReply,
} from "@/lib/yelly/faq-cache"
import { redactPiiForAi } from "@/lib/yelly/pii"
import { YELLY_DISCLAIMER } from "@/lib/yelly/prompt"
import { checkYellyGuestRateLimit, checkYellyUserRateLimit } from "@/lib/yelly/rate-limit"
import { consumeYellyGuestQuota } from "@/lib/yelly/guest-quota"
import { checkRateLimit, getClientIdentifier } from "@/lib/security/rate-limiter"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const GUEST_COOKIE = "yelly_guest_n"

function readGuestCount(request: NextRequest): number {
  const raw = request.cookies.get(GUEST_COOKIE)?.value
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

function guestLimitReached() {
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

/**
 * POST /api/yelly/chat
 * Auth (quota / jour selon palier abo) OU guest (max 3 / 24h : Upstash par IP + cookie)
 * + CSRF + rate-limit IP + rate-limit utilisateur 10/min + zod.
 * Contexte : rôle, produit, historique du chat (PII masquées).
 * FAQ fréquentes servies depuis le cache, sans appel au modèle.
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
    const guestClientId = user ? null : await getClientIdentifier()
    if (!user && guestUsed >= YELLY_GUEST_MAX_PER_DAY) return guestLimitReached()

    {
      // 10/min par utilisateur connecté, et aussi par IP pour les invités.
      const userRate = user
        ? await checkYellyUserRateLimit(user.id)
        : await checkYellyGuestRateLimit(guestClientId ?? "unknown")
      if (!userRate.success) {
        console.warn("[yelly] rate_limited", {
          scope: user ? "user" : "guest",
          user: user ? user.id.slice(0, 8) : null,
          resetAt: new Date(userRate.resetAt).toISOString(),
        })
        return NextResponse.json(
          {
            error: "Trop de questions d’affilée. Réessaie dans une minute.",
            code: "YELLY_USER_RATE_LIMIT",
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.max(1, Math.ceil((userRate.resetAt - Date.now()) / 1000))),
            },
          },
        )
      }
    }

    let tier: string | null = "free"
    let userType: string | null = null
    let yellyRemaining: number | null = null
    let yellyLimit: number | null = null

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, user_type")
        .eq("id", user.id)
        .maybeSingle()
      tier = profile?.subscription_tier ?? "free"
      userType = profile?.user_type ?? null
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

    // Quota invité décompté côté serveur (Upstash par IP + cookie), après validation.
    let guestQuota: { used: number; remaining: number } | null = null
    if (!user) {
      const q = await consumeYellyGuestQuota({
        ip: guestClientId ?? "unknown",
        cookieUsed: guestUsed,
      })
      if (!q.allowed) return guestLimitReached()
      guestQuota = q
    }

    const { message: rawMessage, page, context, conversationId: parsedConvId } =
      parsed.data
    const message = redactPiiForAi(rawMessage, 800)
    const conversationId =
      parsedConvId ||
      (typeof body?.conversationId === "string" &&
      /^[0-9a-f-]{36}$/i.test(body.conversationId)
        ? body.conversationId
        : null)

    const intent = detectYellyIntent(message)
    const chatConversationId = context?.chatConversationId
    const hasContext = Boolean(context?.productId || chatConversationId)

    const [product, history] = await Promise.all([
      loadYellyProductContext(supabase, context?.productId),
      user ? loadChatTurnsForYelly(supabase, chatConversationId, user.id) : Promise.resolve([]),
    ])
    const contextHint = buildYellyContext({
      role: userType,
      product: product ?? (context?.city ? { name: "", city: context.city } : null),
      history,
      intent,
    })

    let result: { reply: string; source: string; model?: string }
    const faq = !hasContext ? matchFaq(message) : null
    const cacheKey = !hasContext && intent === "general" ? genericCacheKey(message, page) : null
    const cached = cacheKey ? readCachedReply(cacheKey) : null
    if (faq) {
      result = { reply: faq.answer, source: "faq" }
    } else if (cached) {
      result = { reply: cached, source: "cache" }
    } else {
      result = await askYelly({
        message,
        page,
        contextHint,
        taskInstruction: buildYellyTaskInstruction(intent),
      })
      if (cacheKey && result.source === "llm") writeCachedReply(cacheKey, result.reply)
      if (result.source === "fallback") {
        // Modèle indisponible : on garde les capacités calculables (prix repère, accord).
        const det = deterministicCapabilityReply(intent, product ?? null, history)
        if (det) result = { reply: det, source: "rules" }
      }
    }

    // L’id de conversation GWA (chat) n’est jamais un id Yelly : persistance séparée.
    let savedId: string | null = chatConversationId === conversationId ? null : conversationId
    if (user) {
      savedId = await persistYellyTurn(supabase, {
        userId: user.id,
        conversationId: savedId,
        userMessage: message,
        assistantReply: result.reply,
        page,
        source: result.source,
      })
      if (yellyRemaining != null) {
        yellyRemaining = Math.max(0, yellyRemaining - 1)
      }
    }

    const guestRemaining = user ? null : (guestQuota?.remaining ?? 0)

    const res = NextResponse.json({
      reply: result.reply,
      source: result.source,
      model: result.model,
      intent,
      disclaimer: YELLY_DISCLAIMER,
      conversationId: savedId,
      assistant: "Yelly",
      guestRemaining,
      yellyLimit,
      yellyRemaining,
      resolved: /merci|c.?est bon|parfait|compris/i.test(message),
    })

    if (!user) {
      res.cookies.set(GUEST_COOKIE, String(guestQuota?.used ?? guestUsed + 1), {
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
