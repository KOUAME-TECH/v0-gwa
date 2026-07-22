import { describe, it, expect } from "vitest"
import { getLinkCooldown, LINK_CHANGE_COOLDOWN_DAYS } from "@/lib/auth/link-cooldown"

describe("getLinkCooldown", () => {
  it("autorise si jamais lié", () => {
    expect(getLinkCooldown(null).allowed).toBe(true)
    expect(getLinkCooldown(undefined).allowed).toBe(true)
  })

  it("bloque si lié récemment", () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const r = getLinkCooldown(recent)
    expect(r.allowed).toBe(false)
    expect(r.daysRemaining).toBeGreaterThan(0)
    expect(r.daysRemaining).toBeLessThanOrEqual(LINK_CHANGE_COOLDOWN_DAYS)
  })

  it("autorise après cooldown", () => {
    const old = new Date(
      Date.now() - (LINK_CHANGE_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString()
    expect(getLinkCooldown(old).allowed).toBe(true)
  })
})
