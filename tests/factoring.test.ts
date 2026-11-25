import { describe, it, expect } from "vitest"
import {
  isFactoringEligible,
  roleCanRequestFactoring,
  FACTORING_MIN_SCORE,
} from "@/lib/factoring/eligibility"

describe("éligibilité affacturage (P11)", () => {
  it("bancable → éligible quel que soit le score", () => {
    expect(isFactoringEligible({ scg_bancable: true, scg_score: 0 })).toBe(true)
  })

  it("drapeau absent : score >= seuil → éligible", () => {
    expect(isFactoringEligible({ scg_score: FACTORING_MIN_SCORE })).toBe(true)
    expect(isFactoringEligible({ scg_bancable: null, scg_score: 750 })).toBe(true)
  })

  it("5C : non bancable calculé (ex. identité non vérifiée, auto-échange) → refusé même à 500+", () => {
    expect(isFactoringEligible({ scg_bancable: false, scg_score: FACTORING_MIN_SCORE })).toBe(false)
    expect(isFactoringEligible({ scg_bancable: false, scg_score: 900 })).toBe(false)
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
