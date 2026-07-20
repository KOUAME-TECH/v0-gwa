// GWA Security - Rate Limiter
// Per spec: "Rate limiting OTP (5 tentatives/15min). Lockout progressif."
// Prefer Upstash Redis when KV_* env vars are present (Vercel Marketplace).

import { headers } from "next/headers"
import {
  hasUpstash,
  upstashGetBlocked,
  upstashIncr,
  upstashSetBlocked,
} from "@/lib/security/upstash"

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  blocked: boolean
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  blockDurationMs?: number
}

const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number; blockedUntil?: number }
>()

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    rateLimitStore.forEach((value, key) => {
      if (value.resetAt < now && (!value.blockedUntil || value.blockedUntil < now)) {
        rateLimitStore.delete(key)
      }
    })
  }, 60000)
}

async function rateLimitRedis(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult | null> {
  if (!hasUpstash()) return null
  const { maxRequests, windowMs, blockDurationMs = 0 } = config
  const now = Date.now()
  const blockKey = `rl:block:${key}`
  const countKey = `rl:count:${key}`

  const blockedUntil = await upstashGetBlocked(blockKey)
  if (blockedUntil && blockedUntil > now) {
    return {
      success: false,
      remaining: 0,
      resetAt: blockedUntil,
      blocked: true,
    }
  }

  const count = await upstashIncr(countKey, windowMs)
  if (count == null) return null

  if (count > maxRequests) {
    if (blockDurationMs > 0) {
      const until = now + blockDurationMs
      await upstashSetBlocked(blockKey, until, blockDurationMs)
      return {
        success: false,
        remaining: 0,
        resetAt: until,
        blocked: true,
      }
    }
    return {
      success: false,
      remaining: 0,
      resetAt: now + windowMs,
      blocked: false,
    }
  }

  return {
    success: true,
    remaining: Math.max(0, maxRequests - count),
    resetAt: now + windowMs,
    blocked: false,
  }
}

function rateLimitMemory(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const { maxRequests, windowMs, blockDurationMs = 0 } = config
  const now = Date.now()

  let record = rateLimitStore.get(key)

  if (record?.blockedUntil && record.blockedUntil > now) {
    return {
      success: false,
      remaining: 0,
      resetAt: record.blockedUntil,
      blocked: true,
    }
  }

  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + windowMs }
    rateLimitStore.set(key, record)
  }

  record.count++

  if (record.count > maxRequests) {
    if (blockDurationMs > 0) {
      record.blockedUntil = now + blockDurationMs
    }
    return {
      success: false,
      remaining: 0,
      resetAt: record.blockedUntil || record.resetAt,
      blocked: !!record.blockedUntil,
    }
  }

  return {
    success: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
    blocked: false,
  }
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const redisResult = await rateLimitRedis(key, config)
    if (redisResult) return redisResult
  } catch (err) {
    console.error("[rate-limit] upstash fallback", err)
  }
  return rateLimitMemory(key, config)
}

export async function getClientIdentifier(): Promise<string> {
  const headersList = await headers()
  const forwardedFor = headersList.get("x-forwarded-for")
  const realIP = headersList.get("x-real-ip")
  const cfConnectingIP = headersList.get("cf-connecting-ip")
  const ip =
    cfConnectingIP || realIP || forwardedFor?.split(",")[0]?.trim() || "unknown"
  return ip
}

export const RATE_LIMITS = {
  OTP_REQUEST: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
  },
  LOGIN_ATTEMPT: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 15 * 60 * 1000,
  },
  PASSWORD_RESET: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  API_GENERAL: { maxRequests: 100, windowMs: 60 * 1000 },
  API_SEARCH: { maxRequests: 30, windowMs: 60 * 1000 },
  API_CREATE: { maxRequests: 20, windowMs: 60 * 1000 },
  PAYMENT: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  },
  KYC_UPLOAD: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  MESSAGE_SEND: { maxRequests: 60, windowMs: 60 * 1000 },
} as const

export async function checkRateLimit(
  endpoint: keyof typeof RATE_LIMITS,
  additionalKey?: string,
): Promise<RateLimitResult> {
  const clientId = await getClientIdentifier()
  const key = additionalKey
    ? `${endpoint}:${clientId}:${additionalKey}`
    : `${endpoint}:${clientId}`
  return rateLimit(key, RATE_LIMITS[endpoint])
}
