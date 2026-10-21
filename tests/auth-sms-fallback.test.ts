import { describe, expect, it } from "vitest"
import { shouldUseSupabasePhoneOtpFallback } from "@/lib/auth/sms"

describe("Supabase phone OTP fallback", () => {
  it("uses Supabase only for login when no custom SMS provider is configured", () => {
    expect(shouldUseSupabasePhoneOtpFallback("login", false, false, false)).toBe(true)
    expect(shouldUseSupabasePhoneOtpFallback("register", false, false, false)).toBe(false)
    expect(shouldUseSupabasePhoneOtpFallback("bind", false, false, false)).toBe(false)
  })

  it("does not bypass a configured Twilio, Africa's Talking, or Termii provider", () => {
    expect(shouldUseSupabasePhoneOtpFallback("login", true, false, false)).toBe(false)
    expect(shouldUseSupabasePhoneOtpFallback("login", false, true, false)).toBe(false)
    expect(shouldUseSupabasePhoneOtpFallback("login", false, false, true)).toBe(false)
  })
})
