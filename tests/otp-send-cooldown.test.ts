import { describe, expect, it, beforeEach, afterEach } from "vitest"
import {
  canSendOtp,
  releaseSendOtp,
  generateOtpCode,
  hashOtpCode,
  verifyOtpHash,
  isOtpStoreReady,
  recordSmsOpsFailure,
  getSmsOpsFailure,
} from "@/lib/auth/otp-store"

describe("OTP send cooldown rollback", () => {
  const phone = "+2250700000099"
  const prev: Record<string, string | undefined> = {}
  const keys = [
    "OTP_PEPPER",
    "VERCEL_ENV",
    "NODE_ENV",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]

  beforeEach(() => {
    for (const k of keys) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
    // Hors production : store mémoire autorisé (NODE_ENV déjà "test" sous vitest)
    process.env.OTP_PEPPER = "test-pepper-otp-cooldown"
  })

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k]
      else process.env[k] = prev[k]
    }
  })

  it("generates 6-digit OTP and verifies peppered hash", () => {
    const code = generateOtpCode()
    expect(code).toMatch(/^\d{6}$/)
    const hash = hashOtpCode(code)
    expect(verifyOtpHash(code, hash)).toBe(true)
    expect(verifyOtpHash("000000", hash)).toBe(false)
  })

  it("releases cooldown so a failed SMS can be retried immediately", async () => {
    expect(await canSendOtp(phone, 60)).toBe(true)
    expect(await canSendOtp(phone, 60)).toBe(false)
    await releaseSendOtp(phone)
    expect(await canSendOtp(phone, 60)).toBe(true)
  })

  it("reports store ready outside production without Upstash", () => {
    expect(isOtpStoreReady()).toBe(true)
  })

  it("records SMS ops failure codes without secrets", async () => {
    await recordSmsOpsFailure("SMS_CREDITS", "africastalking")
    const last = await getSmsOpsFailure()
    expect(last?.code).toBe("SMS_CREDITS")
    expect(last?.provider).toBe("africastalking")
    expect(last?.at).toMatch(/^\d{4}-/)
  })
})
