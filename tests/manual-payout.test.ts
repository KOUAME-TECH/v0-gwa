import { describe, expect, it } from "vitest"
import { parsePagination } from "@/lib/pagination"
import { validateManualPayoutRequest } from "@/lib/wallet/manual-payout"
import { validateManualPayoutUpdate } from "@/lib/wallet/manual-payout-admin"

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
    expect(validateManualPayoutRequest({ ...validRequest, amount: 999 })).toMatchObject({
      ok: false,
      code: "INVALID_AMOUNT",
    })
    expect(validateManualPayoutRequest({ ...validRequest, amount: 1000.5 })).toMatchObject({
      ok: false,
      code: "INVALID_AMOUNT",
    })
  })

  it("does not allow requesting more than the available proceeds", () => {
    expect(validateManualPayoutRequest({ ...validRequest, amount: 20_001 })).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_BALANCE",
    })
  })

  it("rejects malformed phone numbers and unknown payout networks", () => {
    expect(validateManualPayoutRequest({ ...validRequest, phone: "not-a-number" })).toMatchObject({
      ok: false,
      code: "INVALID_PHONE",
    })
    expect(validateManualPayoutRequest({ ...validRequest, network: "unknown" })).toMatchObject({
      ok: false,
      code: "INVALID_NETWORK",
    })
  })
})

describe("manual payout status transitions", () => {
  it("allows only the expected pending and processing transitions", () => {
    expect(validateManualPayoutUpdate("pending", "processing", "")).toEqual({ ok: true })
    expect(validateManualPayoutUpdate("pending", "paid", "REF-123")).toMatchObject({
      ok: false,
      code: "INVALID_TRANSITION",
    })
    expect(validateManualPayoutUpdate("processing", "paid", "REF-123")).toEqual({ ok: true })
    expect(validateManualPayoutUpdate("paid", "failed", "")).toMatchObject({
      ok: false,
      code: "INVALID_TRANSITION",
    })
  })

  it("requires a bounded payout reference before marking a request paid", () => {
    expect(validateManualPayoutUpdate("processing", "paid", "")).toMatchObject({
      ok: false,
      code: "REFERENCE_REQUIRED",
    })
    expect(validateManualPayoutUpdate("processing", "paid", "R".repeat(129))).toMatchObject({
      ok: false,
      code: "REFERENCE_TOO_LONG",
    })
  })
})

describe("pagination query parsing", () => {
  it("floors fractional values and clamps the page size", () => {
    expect(parsePagination(new URLSearchParams("limit=1.5&offset=2.9"))).toEqual({
      limit: 1,
      offset: 2,
    })
    expect(parsePagination(new URLSearchParams("limit=500"))).toEqual({
      limit: 100,
      offset: 0,
    })
  })

  it("uses safe defaults for invalid or negative values", () => {
    expect(parsePagination(new URLSearchParams("limit=-2&offset=-4"))).toEqual({
      limit: 50,
      offset: 0,
    })
  })
})
