import { describe, expect, it } from "vitest"
import { YELLY_GUEST_MAX_PER_DAY } from "@/lib/pricing/entitlements"
import { YELLY_NAME, YELLY_SYSTEM_PROMPT, YELLY_SUGGESTIONS } from "@/lib/yelly/prompt"

describe("Yelly prompt", () => {
  it("defines persona", () => {
    expect(YELLY_NAME).toBe("Yelly")
    expect(YELLY_SYSTEM_PROMPT).toMatch(/Yelly/)
    expect(YELLY_SYSTEM_PROMPT).toMatch(/français/i)
    expect(YELLY_SUGGESTIONS.length).toBeGreaterThan(2)
  })
})

describe("Yelly quotas", () => {
  it("guest max is 3 / 24h (shared with /api/yelly/chat)", () => {
    expect(YELLY_GUEST_MAX_PER_DAY).toBe(3)
  })
})
