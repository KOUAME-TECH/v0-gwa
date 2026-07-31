import { describe, expect, it } from "vitest"
import { ADMIN_AI_TEMPLATES, buildAdminAiContext } from "@/lib/admin/ai-templates"
import { ESCROW_COPY } from "@/lib/copy/escrow-fr"

describe("admin AI templates", () => {
  it("covers all tasks", () => {
    expect(ADMIN_AI_TEMPLATES.moderation.defaultMessage).toMatch(/Rejeter|Approuver/i)
    expect(ADMIN_AI_TEMPLATES.support_reply.defaultMessage.length).toBeGreaterThan(10)
    expect(buildAdminAiContext({ Produit: "Manioc", Prix: 1000 })).toMatch(/Manioc/)
  })
})

describe("escrow copy", () => {
  it("uses unified wording", () => {
    expect(ESCROW_COPY.protected).toMatch(/protégé/i)
    expect(ESCROW_COPY.heldOver48h).toMatch(/48/)
  })
})
