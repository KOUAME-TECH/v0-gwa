import { describe, it, expect } from "vitest"

/** Guard mirror — même règle que POST /api/factoring */
import {
  roleCanRequestFactoring,
  isFactoringEligible,
} from "@/lib/factoring/eligibility"

describe("API factoring — gates rôle + SCG (P0)", () => {
  it("acheteur bancable ne passe pas le gate rôle", () => {
    const roleOk = roleCanRequestFactoring("acheteur")
    const scgOk = isFactoringEligible({ scg_bancable: true, scg_score: 900 })
    expect(roleOk).toBe(false)
    expect(scgOk).toBe(true)
    // L'API doit refuser si !roleOk même si scgOk
    expect(roleOk && scgOk).toBe(false)
  })

  it("producteur non bancable refuse SCG", () => {
    const roleOk = roleCanRequestFactoring("producteur")
    const scgOk = isFactoringEligible({ scg_bancable: false, scg_score: 200 })
    expect(roleOk && scgOk).toBe(false)
  })

  it("coopérative bancable acceptée", () => {
    expect(
      roleCanRequestFactoring("cooperative") &&
        isFactoringEligible({ scg_bancable: true, scg_score: 500 }),
    ).toBe(true)
  })
})
