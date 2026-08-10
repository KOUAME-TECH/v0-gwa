import { describe, it, expect } from "vitest"
import {
  isFactoringEligible,
  roleCanRequestFactoring,
  FACTORING_MIN_SCORE,
} from "@/lib/factoring/eligibility"

describe("éligibilité affacturage (P11)", () => {
  it("flag bancable seul avec score 0 → non éligible (anti-spéculation)", () => {
    expect(isFactoringEligible({ scg_bancable: true, scg_score: 0 })).toBe(false)
  })

  it("flag bancable sans score (legacy) → éligible", () => {
    expect(isFactoringEligible({ scg_bancable: true })).toBe(true)
  })

  it("score >= seuil → éligible", () => {
    expect(isFactoringEligible({ scg_bancable: false, scg_score: FACTORING_MIN_SCORE })).toBe(true)
    expect(isFactoringEligible({ scg_score: 750 })).toBe(true)
  })

  it("score sous le seuil et non bancable → non éligible", () => {
    expect(isFactoringEligible({ scg_bancable: false, scg_score: FACTORING_MIN_SCORE - 1 })).toBe(false)
    expect(isFactoringEligible({})).toBe(false)
    expect(isFactoringEligible(null)).toBe(false)
  })

  it("seuls producteur et cooperative peuvent demander", () => {
    expect(roleCanRequestFactoring("producteur")).toBe(true)
    expect(roleCanRequestFactoring("cooperative")).toBe(true)
    expect(roleCanRequestFactoring("acheteur")).toBe(false)
    expect(roleCanRequestFactoring(null)).toBe(false)
  })
})
