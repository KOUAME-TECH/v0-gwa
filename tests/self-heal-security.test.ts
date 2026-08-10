import { describe, expect, it } from "vitest"
import { evaluateMoneyInvariants, summarizeFindings } from "@/lib/ops/self-heal"
import { assertSameOrigin } from "@/lib/security/csrf"

describe("self-heal money invariants", () => {
  it("flags paid without held escrow", () => {
    const f = evaluateMoneyInvariants({
      payment_status: "paid",
      escrow_status: "pending",
    })
    expect(f.some((x) => x.code === "ESCROW_NOT_HELD")).toBe(true)
  })

  it("flags released with failed payout", () => {
    const f = evaluateMoneyInvariants({
      payment_status: "paid",
      escrow_status: "released",
      payout_status: "failed",
    })
    expect(f.some((x) => x.code === "RELEASED_WITHOUT_PAYOUT")).toBe(true)
    expect(summarizeFindings(f).ok).toBe(false)
  })

  it("ok when paid held", () => {
    const f = evaluateMoneyInvariants({
      payment_status: "paid",
      escrow_status: "held",
      payout_status: null,
      status: "confirmed",
      total_amount: 5000,
    })
    expect(summarizeFindings(f).critical).toBe(0)
  })
})

describe("CSRF ignores x-forwarded-host spoof", () => {
  it("rejects evil Origin even with matching XFH", () => {
    const req = new Request("https://v0-gwa-mu.vercel.app/api/x", {
      method: "POST",
      headers: {
        Host: "v0-gwa-mu.vercel.app",
        "x-forwarded-host": "evil.example",
        Origin: "https://evil.example",
      },
    })
    const res = assertSameOrigin(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(403)
  })
})
