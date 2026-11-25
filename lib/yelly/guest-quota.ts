import { createHmac, randomBytes } from "node:crypto"
import { YELLY_GUEST_MAX_PER_DAY } from "@/lib/pricing/entitlements"
import { rateLimit } from "@/lib/security/rate-limiter"

/** Fenêtre du quota invité : 24 h glissantes depuis la première question. */
export const YELLY_GUEST_WINDOW_MS = 24 * 60 * 60 * 1000

/** Nom du secret serveur (env Vercel ou platform_secrets) qui sale le hachage des IP. */
export const YELLY_IP_HASH_SECRET_KEY = "YELLY_IP_HASH_SECRET"

type SecretResolver = (key: string, envFallbacks?: string[]) => Promise<string>

let processSecret: string | null = null
let warnedFallback = false

async function defaultResolver(key: string, envFallbacks: string[] = []): Promise<string> {
  const { resolvePlatformSecret } = await import("@/lib/ops/platform-secrets")
  return resolvePlatformSecret(key, envFallbacks)
}

/**
 * Secret du hachage, dans l'ordre :
 * 1. `YELLY_IP_HASH_SECRET` (env, puis platform_secrets) ou `IP_HASH_SECRET` en env ;
 * 2. repli stable : dérivé (HMAC) de la clé service_role, jamais exposée ni stockée ;
 * 3. repli ultime : secret aléatoire propre au processus (quota par instance, mais
 *    IP jamais retrouvable par force brute).
 * Jamais de hachage sans secret : une IPv4 se retrouve en quelques secondes.
 */
export async function resolveIpHashSecret(
  resolver: SecretResolver = defaultResolver,
  env: Record<string, string | undefined> = process.env,
): Promise<{ secret: string; source: "configured" | "derived" | "process" }> {
  let configured = ""
  try {
    configured = (await resolver(YELLY_IP_HASH_SECRET_KEY, ["IP_HASH_SECRET"])).trim()
  } catch {
    configured = ""
  }
  if (configured.length >= 16) return { secret: configured, source: "configured" }

  const serviceRole = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  if (serviceRole) {
    return {
      secret: createHmac("sha256", serviceRole).update("gwa:yelly-guest-ip:v1").digest("hex"),
      source: "derived",
    }
  }

  if (!processSecret) processSecret = randomBytes(32).toString("hex")
  if (!warnedFallback) {
    warnedFallback = true
    console.warn("[yelly] YELLY_IP_HASH_SECRET absent : secret aléatoire par instance")
  }
  return { secret: processSecret, source: "process" }
}

/**
 * Clé Upstash du quota invité : HMAC-SHA256(secret serveur, IP).
 * Aucune IP en clair dans Redis, et pas de hachage nu réversible par dictionnaire.
 */
export function yellyGuestQuotaKey(ip: string, secret: string): string {
  const digest = createHmac("sha256", secret)
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
 * Compteur Upstash par IP hachée (repli mémoire si Redis absent) + cookie
 * `yelly_guest_n` : on retient le plus élevé des deux.
 */
export async function consumeYellyGuestQuota(opts: {
  ip: string
  cookieUsed: number
  limiter?: Limiter
  secretResolver?: SecretResolver
}): Promise<YellyGuestQuota> {
  const max = YELLY_GUEST_MAX_PER_DAY
  const cookieUsed = Math.max(0, Math.floor(opts.cookieUsed || 0))
  if (cookieUsed >= max) return { allowed: false, used: max, remaining: 0 }

  const { secret } = await resolveIpHashSecret(opts.secretResolver)
  const limiter = opts.limiter ?? rateLimit
  const r = await limiter(yellyGuestQuotaKey(opts.ip, secret), {
    maxRequests: max,
    windowMs: YELLY_GUEST_WINDOW_MS,
  })
  if (!r.success) return { allowed: false, used: max, remaining: 0 }

  const serverUsed = max - Math.max(0, Math.min(max, r.remaining))
  const used = Math.min(max, Math.max(serverUsed, cookieUsed + 1))
  return { allowed: true, used, remaining: Math.max(0, max - used) }
}
