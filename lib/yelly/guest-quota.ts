import { createHash } from "node:crypto"
import { YELLY_GUEST_MAX_PER_DAY } from "@/lib/pricing/entitlements"
import { rateLimit } from "@/lib/security/rate-limiter"

/** Fenêtre du quota invité : 24 h glissantes depuis la première question. */
export const YELLY_GUEST_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Clé Upstash du quota invité. L'IP est hachée : aucune IP en clair dans Redis.
 * (Préfixe distinct du rate-limit 10/min, qui reste en place.)
 */
export function yellyGuestQuotaKey(ip: string): string {
  const digest = createHash("sha256")
    .update(`yelly-guest:${ip || "unknown"}`)
    .digest("hex")
    .slice(0, 32)
  return `YELLY_GUEST_DAY:${digest}`
}

export type YellyGuestQuota = {
  /** La question peut partir. */
  allowed: boolean
  /** Questions consommées, celle-ci comprise (borné au plafond). */
  used: number
  /** Questions restantes après celle-ci. */
  remaining: number
}

type Limiter = typeof rateLimit

/**
 * Décompte le quota invité (3 / 24 h) côté serveur.
 * Compteur Upstash par IP (repli mémoire si Redis absent) + cookie `yelly_guest_n` :
 * on retient le plus élevé des deux. Vider ses cookies ne remet donc plus le
 * compteur à zéro, et un client sans cookie voit `guestRemaining` baisser.
 */
export async function consumeYellyGuestQuota(opts: {
  ip: string
  cookieUsed: number
  limiter?: Limiter
}): Promise<YellyGuestQuota> {
  const max = YELLY_GUEST_MAX_PER_DAY
  const cookieUsed = Math.max(0, Math.floor(opts.cookieUsed || 0))
  if (cookieUsed >= max) return { allowed: false, used: max, remaining: 0 }

  const limiter = opts.limiter ?? rateLimit
  const r = await limiter(yellyGuestQuotaKey(opts.ip), {
    maxRequests: max,
    windowMs: YELLY_GUEST_WINDOW_MS,
  })
  if (!r.success) return { allowed: false, used: max, remaining: 0 }

  const serverUsed = max - Math.max(0, Math.min(max, r.remaining))
  const used = Math.min(max, Math.max(serverUsed, cookieUsed + 1))
  return { allowed: true, used, remaining: Math.max(0, max - used) }
}
