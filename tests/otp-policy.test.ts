import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  OTP_POLICY,
  acquireOtpVerifyLock,
  bumpOtpAttempts,
  clearOtp,
  getOtp,
  releaseOtpVerifyLock,
  storeOtp,
  verifyOtpHash,
} from "@/lib/auth/otp-store"
import { rateLimit } from "@/lib/security/rate-limiter"

const ENV = ["OTP_PEPPER", "KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]
const saved: Record<string, string | undefined> = {}

describe("Politique OTP (phase 5)", () => {
  beforeEach(() => {
    for (const k of ENV) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
    process.env.OTP_PEPPER = "test-pepper-otp-policy"
  })
  afterEach(() => {
    vi.useRealTimers()
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it("expire après 5 minutes", async () => {
    expect(OTP_POLICY.ttlSeconds).toBe(300)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-25T10:00:00Z"))
    const phone = "+2250700000101"
    await storeOtp(phone, { code: "123456", userId: "u1", email: "x@users.gwa.local", phone })
    vi.setSystemTime(new Date("2026-11-25T10:04:59Z"))
    expect(await getOtp(phone)).not.toBeNull()
    vi.setSystemTime(new Date("2026-11-25T10:05:01Z"))
    expect(await getOtp(phone)).toBeNull()
  })

  it("est à usage unique : supprimé après validation, verrou contre les vérifications simultanées", async () => {
    const phone = "+2250700000102"
    await storeOtp(phone, { code: "654321", userId: "u2", email: "y@users.gwa.local", phone })
    const stored = await getOtp(phone)
    expect(stored && verifyOtpHash("654321", stored.codeHash)).toBe(true)
    expect(stored?.codeHash).not.toContain("654321")

    expect(await acquireOtpVerifyLock(phone)).toBe(true)
    expect(await acquireOtpVerifyLock(phone)).toBe(false) // 2e requête concurrente refusée
    await clearOtp(phone) // succès → code consommé
    await releaseOtpVerifyLock(phone)
    expect(await getOtp(phone)).toBeNull() // réutilisation impossible
    expect(await acquireOtpVerifyLock(phone)).toBe(true)
    await releaseOtpVerifyLock(phone)
  })

  it("compte les essais sur un même code (5 maximum)", async () => {
    const phone = "+2250700000103"
    await storeOtp(phone, { code: "111111", userId: "u3", email: "z@users.gwa.local", phone })
    for (let i = 1; i <= OTP_POLICY.maxAttemptsPerCode; i++) expect(await bumpOtpAttempts(phone)).toBe(i)
    expect((await getOtp(phone))?.attempts).toBe(5)
  })

  it("limite à 5 tentatives par heure et par numéro", async () => {
    expect(OTP_POLICY.verifyPerHour).toEqual({ maxRequests: 5, windowMs: 3_600_000 })
    expect(OTP_POLICY.sendPerHour).toEqual({ maxRequests: 5, windowMs: 3_600_000 })
    const phone = "+2250700000104"
    for (let i = 0; i < 5; i++) {
      expect((await rateLimit(`OTP_VERIFY_H:${phone}`, OTP_POLICY.verifyPerHour)).success).toBe(true)
    }
    expect((await rateLimit(`OTP_VERIFY_H:${phone}`, OTP_POLICY.verifyPerHour)).success).toBe(false)
    // un autre numéro n'est pas affecté
    expect((await rateLimit(`OTP_VERIFY_H:+2250700000105`, OTP_POLICY.verifyPerHour)).success).toBe(true)
  })
})

describe("Routes OTP : la politique est câblée", () => {
  it("send-otp et verify-otp utilisent OTP_POLICY", async () => {
    const { readFileSync } = await import("node:fs")
    const send = readFileSync("app/api/auth/send-otp/route.ts", "utf8")
    const verify = readFileSync("app/api/auth/verify-otp/route.ts", "utf8")
    expect(send).toContain("OTP_SEND_H:")
    expect(send).toContain("expires_in: OTP_POLICY.ttlSeconds")
    expect(verify).toContain("OTP_VERIFY_H:")
    expect(verify).toContain("acquireOtpVerifyLock")
    expect(verify).toContain("OTP_POLICY.maxAttemptsPerCode")
    expect(readFileSync("lib/auth/sms.ts", "utf8")).toContain("Valable 5 min")
  })
})
