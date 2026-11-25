import { rateLimit } from "@/lib/security/rate-limiter"

/** Directive t127u : 10 appels Gemini par minute et par utilisateur (Upstash, repli mémoire). */
export const YELLY_USER_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000,
} as const

export function yellyUserRateKey(userId: string): string {
  return `YELLY_USER:${userId}`
}

export function checkYellyUserRateLimit(
  userId: string,
): Promise<Awaited<ReturnType<typeof rateLimit>>> {
  return rateLimit(yellyUserRateKey(userId), { ...YELLY_USER_RATE_LIMIT })
}
