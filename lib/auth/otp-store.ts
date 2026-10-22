import { createHash, randomInt, timingSafeEqual } from "crypto"
import {
  hasUpstash,
  upstashIncr,
} from "@/lib/security/upstash"
import { Redis } from "@upstash/redis"

/**
 * "login":    phone known (verified or not) → mint session after OTP.
 * "bind":     authenticated user attaching phone to own account.
 * "register": new phone → create auth user + profile after OTP.
 */
export type OtpMode = "login" | "bind" | "register"

export type StoredOtp = {
  /** SHA-256 hex of code + pepper — never store plaintext */
  codeHash: string
  userId: string
  email: string
  phone: string
  mode: OtpMode
  attempts: number
  createdAt: number
}

const memoryStore = new Map<string, StoredOtp & { expiresAt: number }>()

function getRedis(): Redis | null {
  if (!hasUpstash()) return null
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function otpKey(phoneE164: string) {
  return `gwa:otp:${phoneE164}`
}

function otpPepper(): string {
  const pepper = process.env.OTP_PEPPER
  if (pepper) return pepper

  // Fail closed en production : un pepper dédié est obligatoire.
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error(
      "OTP_PEPPER manquant en production — refus de hacher un OTP avec un secret par défaut",
    )
  }

  // Hors production : fallback pour le développement local uniquement.
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "gwa-dev-otp-pepper"
}

export function isOtpStoreReady(): boolean {
  const production =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
  return (
    !production ||
    (hasUpstash() && Boolean(process.env.OTP_PEPPER?.trim()))
  )
}

export function hashOtpCode(code: string): string {
  return createHash("sha256")
    .update(`${code}:${otpPepper()}`)
    .digest("hex")
}

export function verifyOtpHash(code: string, codeHash: string): boolean {
  try {
    const a = Buffer.from(hashOtpCode(code), "hex")
    const b = Buffer.from(codeHash, "hex")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Cryptographically secure 6-digit OTP */
export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000))
}

export async function storeOtp(
  phoneE164: string,
  payload: {
    code: string
    userId: string
    email: string
    phone: string
    mode?: OtpMode
  },
  ttlSeconds = 600,
): Promise<void> {
  const data: StoredOtp = {
    codeHash: hashOtpCode(payload.code),
    userId: payload.userId,
    email: payload.email,
    phone: payload.phone,
    mode: payload.mode ?? "login",
    attempts: 0,
    createdAt: Date.now(),
  }
  const redis = getRedis()
  if (redis) {
    await redis.set(otpKey(phoneE164), data, { ex: ttlSeconds })
    return
  }
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Persistent OTP storage is required in production")
  }
  memoryStore.set(otpKey(phoneE164), {
    ...data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export async function getOtp(phoneE164: string): Promise<StoredOtp | null> {
  const redis = getRedis()
  if (redis) {
    const val = await redis.get<StoredOtp>(otpKey(phoneE164))
    return val ?? null
  }
  const mem = memoryStore.get(otpKey(phoneE164))
  if (!mem) return null
  if (mem.expiresAt < Date.now()) {
    memoryStore.delete(otpKey(phoneE164))
    return null
  }
  const { expiresAt: _, ...rest } = mem
  return rest
}

export async function bumpOtpAttempts(phoneE164: string): Promise<number> {
  const current = await getOtp(phoneE164)
  if (!current) return 999
  const next = { ...current, attempts: current.attempts + 1 }
  const redis = getRedis()
  if (redis) {
    const ttl = await redis.ttl(otpKey(phoneE164))
    await redis.set(otpKey(phoneE164), next, {
      ex: ttl > 0 ? ttl : 600,
    })
  } else {
    const mem = memoryStore.get(otpKey(phoneE164))
    if (mem) {
      memoryStore.set(otpKey(phoneE164), { ...mem, ...next })
    }
  }
  return next.attempts
}

export async function clearOtp(phoneE164: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.del(otpKey(phoneE164))
    return
  }
  memoryStore.delete(otpKey(phoneE164))
}

/** Anti-spam envoi OTP (indépendant du rate-limit IP) */
export async function canSendOtp(
  phoneE164: string,
  minIntervalSec = 60,
): Promise<boolean> {
  const key = `gwa:otp:send:${phoneE164}`
  const redis = getRedis()
  if (redis) {
    const count = await upstashIncr(key, minIntervalSec * 1000)
    return count === 1 || count === null
  }
  const mem = memoryStore.get(key)
  if (mem && mem.expiresAt > Date.now()) return false
  memoryStore.set(key, {
    codeHash: "",
    userId: "",
    email: "",
    phone: phoneE164,
    mode: "login",
    attempts: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + minIntervalSec * 1000,
  })
  return true
}
