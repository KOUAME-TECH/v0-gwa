import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminSection } from "@/lib/auth/require-admin"
import {
  ADMIN_AI_PAGE,
  adminAiEntitlements,
  canRunAdminAiTask,
  canUseAdminAiToday,
  type AdminAiTask,
} from "@/lib/admin/ai-entitlements"
import { YELLY_OPS_SYSTEM_PROMPT } from "@/lib/admin/ai-prompt"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { askYelly } from "@/lib/yelly/client"
import {
  countYellyUserMessagesToday,
  persistYellyTurn,
} from "@/lib/yelly/context"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  task: z
    .enum([
      "general",
      "moderation",
      "support_reply",
      "dispute_summary",
      "factoring",
      "coop",
    ])
    .default("general"),
  context: z.string().max(6000).optional(),
  conversationId: z
    .string()
    .regex(/^[0-9a-f-]{36}$/i)
    .optional()
    .nullable(),
})

/**
 * POST /api/admin/ai/assist
 * Yelly Ops — IA backoffice avec quota / jour selon rôle admin.
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("YELLY_CHAT")
    if (!rate.success) {
      return NextResponse.json(
        { error: "IA saturée. Réessaie dans une minute." },
        { status: 429 },
      )
    }

    const gate = await requireAdminSection("ai")
    if (!gate.isAdmin || !gate.role || !gate.user || !gate.supabase) {
      return NextResponse.json(
        { error: gate.error || "Admin requis" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const role = gate.role.role
    const entitlements = adminAiEntitlements(role)

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requête invalide", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const task = parsed.data.task as AdminAiTask
    if (!canRunAdminAiTask(role, task)) {
      return NextResponse.json(
        {
          error: `Tâche « ${task} » non autorisée pour le rôle ${role}`,
          code: "ADMIN_AI_TASK_FORBIDDEN",
        },
        { status: 403 },
      )
    }

    const usedToday = await countYellyUserMessagesToday(
      gate.supabase,
      gate.user.id,
      new Date(),
      { pageEq: ADMIN_AI_PAGE },
    )
    const quota = canUseAdminAiToday(role, usedToday)
    if (!quota.ok) {
      return NextResponse.json(
        {
          error: quota.message,
          code: quota.code,
          aiLimit: quota.limit,
          aiRemaining: 0,
        },
        { status: 429 },
      )
    }

    const taskHint: Record<AdminAiTask, string> = {
      general: "Tâche : assistance générale backoffice.",
      moderation:
        "Tâche : brouillon décision modération produit (approuver / rejeter + motif).",
      support_reply: "Tâche : brouillon réponse support client (ton empathique, clair).",
      dispute_summary:
        "Tâche : résumé litige escrow + recommandation freeze / release / investigation.",
      factoring: "Tâche : lecture dossier affacturage + points de vigilance.",
      coop: "Tâche : qualification coopérative (membres, docs, risques).",
    }

    const contextHint = [taskHint[task], parsed.data.context]
      .filter(Boolean)
      .join("\n\n")

    const result = await askYelly({
      message: parsed.data.message,
      page: ADMIN_AI_PAGE,
      contextHint,
      systemPrompt: YELLY_OPS_SYSTEM_PROMPT,
    })

    const savedId = await persistYellyTurn(gate.supabase, {
      userId: gate.user.id,
      conversationId: parsed.data.conversationId || null,
      userMessage: parsed.data.message,
      assistantReply: result.reply,
      page: ADMIN_AI_PAGE,
      source: result.source,
    })

    const remaining =
      quota.remaining == null ? null : Math.max(0, quota.remaining - 1)

    return NextResponse.json({
      reply: result.reply,
      source: result.source,
      model: result.model,
      assistant: "Yelly Ops",
      task,
      conversationId: savedId || parsed.data.conversationId || null,
      aiLimit: quota.limit,
      aiRemaining: remaining,
      entitlements: {
        role: entitlements.role,
        requestsPerDay: entitlements.requestsPerDay,
      },
    })
  } catch (err) {
    console.error("[api/admin/ai/assist]", err)
    return NextResponse.json({ error: "IA admin indisponible" }, { status: 500 })
  }
}

/** GET — état quota */
export async function GET() {
  try {
    const gate = await requireAdminSection("ai")
    if (!gate.isAdmin || !gate.role || !gate.user || !gate.supabase) {
      return NextResponse.json(
        { error: gate.error || "Admin requis" },
        { status: gate.user ? 403 : 401 },
      )
    }
    const role = gate.role.role
    const usedToday = await countYellyUserMessagesToday(
      gate.supabase,
      gate.user.id,
      new Date(),
      { pageEq: ADMIN_AI_PAGE },
    )
    const quota = canUseAdminAiToday(role, usedToday)
    const entitlements = adminAiEntitlements(role)
    return NextResponse.json({
      role,
      usedToday,
      aiLimit: quota.limit,
      aiRemaining: quota.remaining,
      entitlements,
    })
  } catch (err) {
    console.error("[api/admin/ai/assist GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
