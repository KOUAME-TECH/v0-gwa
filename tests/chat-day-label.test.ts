import { describe, expect, it } from "vitest"
import { chatDayLabel } from "@/lib/chat/day-label"

describe("chatDayLabel", () => {
  const now = new Date("2026-11-02T15:00:00Z")

  it("Aujourd’hui / Hier", () => {
    expect(chatDayLabel("2026-11-02T08:00:00Z", now)).toBe("Aujourd’hui")
    expect(chatDayLabel("2026-11-01T20:00:00Z", now)).toBe("Hier")
  })

  it("jour de la semaine pour <7j", () => {
    const label = chatDayLabel("2026-10-30T12:00:00Z", now)
    expect(label.length).toBeGreaterThan(2)
    expect(label).not.toMatch(/Aujourd/)
  })
})
