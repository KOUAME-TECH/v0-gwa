import { describe, expect, it } from "vitest"
import { redactPiiForAi } from "@/lib/yelly/pii"

describe("redactPiiForAi", () => {
  it("masque email et téléphone", () => {
    const out = redactPiiForAi("Contacte-moi : ama@test.com ou +225 07 88 32 60 19")
    expect(out).toContain("[email masqué]")
    expect(out).toContain("[téléphone masqué]")
    expect(out).not.toContain("ama@test.com")
  })

  it("conserve un montant FCFA court", () => {
    const out = redactPiiForAi("Je propose 15000 FCFA")
    expect(out).toContain("15000")
  })

  it("masque un code OTP", () => {
    const out = redactPiiForAi("Mon code OTP: 482913")
    expect(out).toContain("[code masqué]")
  })
})
