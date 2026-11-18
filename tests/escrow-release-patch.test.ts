import { describe, expect, it } from "vitest"
import { buildEscrowReleasePatch } from "@/lib/orders/escrow-release"

describe("buildEscrowReleasePatch", () => {
  const now = "2026-11-18T10:00:00.000Z"
  it("pose pending_ops quand payout_status est NULL", () => {
    expect(buildEscrowReleasePatch({ payout_status: null }, now)).toEqual({
      escrow_status: "released", status: "delivered", updated_at: now, payout_status: "pending_ops",
    })
    expect(buildEscrowReleasePatch({}, now).payout_status).toBe("pending_ops")
  })
  it("n'écrase jamais un payout_status existant", () => {
    for (const s of ["pending_ops", "failed", "skipped_no_provider", "cancelled", "paid"]) {
      expect(buildEscrowReleasePatch({ payout_status: s }, now).payout_status).toBe(s)
    }
  })
  it("écrit 'delivered' (le CHECK prod refuse 'livre')", () => {
    expect(buildEscrowReleasePatch({ payout_status: null }, now).status).toBe("delivered")
  })
})
