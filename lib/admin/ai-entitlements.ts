/**
 * Quotas IA backoffice — par rôle admin (coût Gemini maîtrisé).
 * Indépendant des quotas Yelly vendeur (`yellyRequestsPerDay`).
 */
import type { AdminRole } from "@/lib/auth/admin-permissions"

export type AdminAiEntitlements = {
  role: AdminRole
  /** null = illimité (anti-abus IP reste) */
  requestsPerDay: number | null
  /** Actions autorisées pour le prompt / API */
  canDraftModeration: boolean
  canDraftSupportReply: boolean
  canSummarizeDispute: boolean
  canSuggestFactoring: boolean
  canAnalyzeCoop: boolean
}

const BY_ROLE: Record<AdminRole, Omit<AdminAiEntitlements, "role">> = {
  moderator: {
    requestsPerDay: 40,
    canDraftModeration: true,
    canDraftSupportReply: true,
    canSummarizeDispute: false,
    canSuggestFactoring: false,
    canAnalyzeCoop: false,
  },
  support: {
    requestsPerDay: 60,
    canDraftModeration: false,
    canDraftSupportReply: true,
    canSummarizeDispute: true,
    canSuggestFactoring: false,
    canAnalyzeCoop: false,
  },
  admin: {
    requestsPerDay: 120,
    canDraftModeration: true,
    canDraftSupportReply: true,
    canSummarizeDispute: true,
    canSuggestFactoring: true,
    canAnalyzeCoop: true,
  },
  super_admin: {
    requestsPerDay: null,
    canDraftModeration: true,
    canDraftSupportReply: true,
    canSummarizeDispute: true,
    canSuggestFactoring: true,
    canAnalyzeCoop: true,
  },
}

export const ADMIN_AI_PAGE = "admin-assist"

export type AdminAiTask =
  | "general"
  | "moderation"
  | "support_reply"
  | "dispute_summary"
  | "factoring"
  | "coop"

export function adminAiEntitlements(role: AdminRole): AdminAiEntitlements {
  return { role, ...BY_ROLE[role] }
}

export function adminAiDailyLimit(role: AdminRole): number | null {
  return BY_ROLE[role].requestsPerDay
}

export function canRunAdminAiTask(
  role: AdminRole,
  task: AdminAiTask,
): boolean {
  const e = BY_ROLE[role]
  switch (task) {
    case "moderation":
      return e.canDraftModeration
    case "support_reply":
      return e.canDraftSupportReply
    case "dispute_summary":
      return e.canSummarizeDispute
    case "factoring":
      return e.canSuggestFactoring
    case "coop":
      return e.canAnalyzeCoop
    default:
      return true
  }
}

export function canUseAdminAiToday(
  role: AdminRole,
  usedToday: number,
): {
  ok: boolean
  limit: number | null
  remaining: number | null
  code?: string
  message?: string
} {
  const limit = adminAiDailyLimit(role)
  if (limit == null) return { ok: true, limit: null, remaining: null }
  const used = Math.max(0, Math.floor(usedToday))
  if (used >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      code: "ADMIN_AI_DAILY_LIMIT",
      message: `Quota IA admin atteint (${limit}/jour pour ${role}). Reviens demain.`,
    }
  }
  return { ok: true, limit, remaining: limit - used }
}
