import { describe, it, expect } from "vitest"
import { shouldShowVerifiedBadge } from "@/lib/verification/badge"

describe("badge vérifié (P8)", () => {
  it("affiché si is_verified true et KYC approuvé", () => {
    expect(shouldShowVerifiedBadge({ is_verified: true, kyc_status: "approved" })).toBe(true)
  })

  it("masqué si is_verified false, même avec KYC approuvé", () => {
    expect(shouldShowVerifiedBadge({ is_verified: false, kyc_status: "approved" })).toBe(false)
  })

  it("masqué si is_verified true mais KYC non approuvé", () => {
    expect(shouldShowVerifiedBadge({ is_verified: true, kyc_status: "pending" })).toBe(false)
    expect(shouldShowVerifiedBadge({ is_verified: true, kyc_status: "rejected" })).toBe(false)
  })

  it("fait confiance à is_verified quand le statut KYC est inconnu", () => {
    expect(shouldShowVerifiedBadge({ is_verified: true })).toBe(true)
    expect(shouldShowVerifiedBadge({ is_verified: false })).toBe(false)
  })

  it("null / undefined → pas de badge", () => {
    expect(shouldShowVerifiedBadge(null)).toBe(false)
    expect(shouldShowVerifiedBadge(undefined)).toBe(false)
  })
})
