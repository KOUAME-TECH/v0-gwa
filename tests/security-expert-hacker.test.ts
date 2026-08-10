import { describe, expect, it } from "vitest"
import { assertSameOrigin } from "@/lib/security/csrf"
import { safeSelfServeUserType } from "@/lib/auth/dual-identity"
import { parseOfferContent, buildOfferContent } from "@/lib/chat/offer"

describe("safeSelfServeUserType", () => {
  it("allows acheteur/producteur aliases", () => {
    expect(safeSelfServeUserType("buyer")).toBe("acheteur")
    expect(safeSelfServeUserType("farmer")).toBe("producteur")
    expect(safeSelfServeUserType("acheteur")).toBe("acheteur")
  })

  it("blocks cooperative and unknown privilege escalation", () => {
    expect(safeSelfServeUserType("cooperative")).toBeUndefined()
    expect(safeSelfServeUserType("admin")).toBeUndefined()
    expect(safeSelfServeUserType("super_admin")).toBeUndefined()
  })
})

describe("offer accepted_by contract", () => {
  it("parses accepted_by from server payload", () => {
    const raw = buildOfferContent({ amount: 5000, productId: "p1" })
    const offer = parseOfferContent(raw)!
    const accepted = {
      ...offer,
      status: "accepted" as const,
      accepted_by: "counterparty-uuid",
      accepted_at: new Date().toISOString(),
    }
    const parsed = parseOfferContent(JSON.stringify(accepted))
    expect(parsed?.accepted_by).toBe("counterparty-uuid")
    expect(parsed?.status).toBe("accepted")
  })

  it("detects self-accept pattern as invalid for from-offer", () => {
    const offer = parseOfferContent(
      JSON.stringify({
        v: 1,
        kind: "price_offer",
        amount: 1000,
        currency: "XOF",
        status: "accepted",
        accepted_by: "same-sender",
      }),
    )!
    const senderId = "same-sender"
    const valid =
      !!offer.accepted_by &&
      offer.accepted_by !== senderId &&
      offer.status === "accepted"
    expect(valid).toBe(false)
  })
})

describe("CSRF cron bearer still needs secret match", () => {
  it("rejects x-vercel-cron alone without CRON_SECRET bearer", () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = "real-secret"
    const req = new Request("https://v0-gwa-mu.vercel.app/api/x", {
      method: "POST",
      headers: {
        "x-vercel-cron": "1",
        Host: "v0-gwa-mu.vercel.app",
      },
    })
    const res = assertSameOrigin(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(403)
    process.env.CRON_SECRET = prev
  })
})
