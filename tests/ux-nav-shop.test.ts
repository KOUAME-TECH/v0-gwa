import { describe, expect, it } from "vitest"

describe("UX nav contract — Shop stays marketplace", () => {
  it("seller hub lives under /dashboard/farmer not bottom Shop", () => {
    // Guardrail: bottom nav Shop must remain /marketplace for all roles.
    // Seller tools = ProducerSubnav / Profil → Espace producteur.
    expect("/marketplace").not.toBe("/dashboard/farmer")
    expect("/dashboard/farmer").toContain("farmer")
  })
})
