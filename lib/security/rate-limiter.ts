// GWA Security - Rate Limiter
// Per spec: "Rate limiting OTP (5 tentatives/15min). Lockout progressif."

import { headers } from "next/headers"

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

// In-memory store for rate limiting (would use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number; blockedUntil?: number }>()

// Cleanup old entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    rateLimitStore.forEach((value, key) => {
      if (value.resetAt < now && (!value.blockedUntil || value.blockedUntil < now)) {
        rateLimitStore.delete(key)
      }
    })
  }, 60000) // Cleanup every minute
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, blockDurationMs = 0 } = config
  const now = Date.now()
  
  let record = rateLimitStore.get(key)
  
  // Check if blocked
  if (record?.blockedUntil && record.blockedUntil > now) {
    return {
      success: false,
      remaining: 0,
      resetAt: record.blockedUntil,
      blocked: true,
    }
  }
  
  // Reset if window expired
  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + windowMs }
    rateLimitStore.set(key, record)
  }
  
  // Increment count
  record.count++
  
  // Check if over limit
  if (record.count > maxRequests) {
    // Apply block if configured
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

// Get client identifier for rate limiting
export async function getClientIdentifier(): Promise<string> {
  const headersList = await headers()
  
  // Try various headers for real IP
  const forwardedFor = headersList.get("x-forwarded-for")
  const realIP = headersList.get("x-real-ip")
  const cfConnectingIP = headersList.get("cf-connecting-ip")
  
  const ip = cfConnectingIP || realIP || forwardedFor?.split(",")[0]?.trim() || "unknown"
  
  return ip
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  // Auth endpoints - strict
  OTP_REQUEST: { maxRequests: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 30 * 60 * 1000 }, // 5 per 15min, block 30min
  LOGIN_ATTEMPT: { maxRequests: 10, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 }, // 10 per 15min
  PASSWORD_RESET: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  
  // API endpoints - moderate
  API_GENERAL: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 per minute
  API_SEARCH: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per minute
  API_CREATE: { maxRequests: 20, windowMs: 60 * 1000 }, // 20 per minute
  
  // Sensitive operations
  PAYMENT: { maxRequests: 10, windowMs: 60 * 1000, blockDurationMs: 5 * 60 * 1000 }, // 10 per minute
  KYC_UPLOAD: { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  MESSAGE_SEND: { maxRequests: 60, windowMs: 60 * 1000 }, // 60 per minute
} as const

// Helper for API routes
export async function checkRateLimit(
  endpoint: keyof typeof RATE_LIMITS,
  additionalKey?: string
): Promise<RateLimitResult> {
  const clientId = await getClientIdentifier()
  const key = additionalKey 
    ? `${endpoint}:${clientId}:${additionalKey}` 
    : `${endpoint}:${clientId}`
  
  return rateLimit(key, RATE_LIMITS[endpoint])
}
