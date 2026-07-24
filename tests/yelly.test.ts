import { describe, expect, it } from "vitest"
import { YELLY_NAME, YELLY_SYSTEM_PROMPT, YELLY_SUGGESTIONS } from "@/lib/yelly/prompt"

describe("Yelly prompt", () => {
  it("defines persona", () => {
    expect(YELLY_NAME).toBe("Yelly")
    expect(YELLY_SYSTEM_PROMPT).toMatch(/Yelly/)
    expect(YELLY_SYSTEM_PROMPT).toMatch(/français/i)
    expect(YELLY_SUGGESTIONS.length).toBeGreaterThan(2)
  })
})
