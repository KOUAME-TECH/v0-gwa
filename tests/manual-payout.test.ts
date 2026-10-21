import { describe, expect, it } from "vitest"
import { validateManualPayoutRequest } from "@/lib/wallet/manual-payout"

const validRequest = {
  amount: 10_000,
  phone: " 07 00 00 00 00 ",
  network: "orange_ci",
  available: 20_000,
}

describe("manual payout request validation", () => {
  it("normalizes the destination number and accepts a supported request", () => {
    expect(validateManualPayoutRequest(validRequest)).toEqual({
      ok: true,
      amount: 10_000,
      phone: "07 00 00 00 00",
      network: "orange_ci",
    })
  })

  it("requires an integer amount at or above the minimum", () => {
    expect(validateManualPayoutRequest({ ...validRequest, amount: 999 }).code).toBe("INVALID_AMOUNT")
    expect(validateManualPayoutRequest({ ...validRequest, amount: 1000.5 }).code).toBe("INVALID_AMOUNT")
  })

  it("does not allow requesting more than the available proceeds", () => {
    expect(validateManualPayoutRequest({ ...validRequest, amount: 20_001 }).code).toBe(
      "INSUFFICIENT_BALANCE",
    )
  })

  it("rejects malformed phone numbers and unknown payout networks", () => {
    expect(validateManualPayoutRequest({ ...validRequest, phone: "not-a-number" }).code).toBe(
      "INVALID_PHONE",
    )
    expect(validateManualPayoutRequest({ ...validRequest, network: "unknown" }).code).toBe(
      "INVALID_NETWORK",
    )
  })
})
