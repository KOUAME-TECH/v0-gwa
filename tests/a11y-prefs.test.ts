import { describe, expect, it } from "vitest"
import { isQuietHoursNow } from "@/hooks/use-a11y-prefs"
import { ESCROW_COPY } from "@/lib/copy/escrow-fr"

describe("a11y prefs helpers", () => {
  it("quiet hours 22h–6h UTC", () => {
    expect(isQuietHoursNow(true, new Date("2026-07-31T23:00:00Z"))).toBe(true)
    expect(isQuietHoursNow(true, new Date("2026-07-31T10:00:00Z"))).toBe(false)
    expect(isQuietHoursNow(false, new Date("2026-07-31T23:00:00Z"))).toBe(false)
  })
})

describe("simple copy for everyone", () => {
  it("escrow wording stays short and clear", () => {
    expect(ESCROW_COPY.buyerConfirmCta.split(" ").length).toBeLessThanOrEqual(5)
    expect(ESCROW_COPY.protected.split(" ").length).toBeLessThanOrEqual(3)
  })
})
