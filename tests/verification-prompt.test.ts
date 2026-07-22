import { describe, it, expect } from "vitest"
import {
  shouldShowVerifiedBadge,
  shouldPromptIdentityVerification,
} from "@/lib/verification/badge"

describe("identity verification prompts", () => {
  it("prompt seulement si pas encore fait", () => {
    expect(shouldPromptIdentityVerification({})).toBe(true)
    expect(shouldPromptIdentityVerification({ kyc_status: null })).toBe(true)
    expect(shouldPromptIdentityVerification({ kyc_status: "rejected" })).toBe(true)
    expect(shouldPromptIdentityVerification({ kyc_status: "pending" })).toBe(false)
    expect(shouldPromptIdentityVerification({ kyc_status: "approved" })).toBe(false)
    expect(shouldPromptIdentityVerification({ is_verified: true })).toBe(false)
  })

  it("badge seulement si is_verified", () => {
    expect(shouldShowVerifiedBadge({ is_verified: true })).toBe(true)
    expect(shouldShowVerifiedBadge({ is_verified: false })).toBe(false)
    expect(
      shouldShowVerifiedBadge({ is_verified: true, kyc_status: "pending" }),
    ).toBe(false)
  })
})
