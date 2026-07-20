import { describe, it, expect } from "vitest"
import {
  shouldShowHibpBanner,
  HIBP_CAMPAIGN_ENDS_AT,
  HIBP_BANNER_MESSAGE,
} from "@/lib/auth/hibp-banner"

describe("bannière HIBP (campagne 1 semaine)", () => {
  it("affiche un message FR clair", () => {
    expect(HIBP_BANNER_MESSAGE).toMatch(/compromis/i)
  })

  it("visible avant la fin de campagne si non dismiss", () => {
    const before = new Date(HIBP_CAMPAIGN_ENDS_AT.getTime() - 60_000)
    expect(shouldShowHibpBanner(before, false)).toBe(true)
  })

  it("masquée après dismiss ou après la campagne", () => {
    const before = new Date(HIBP_CAMPAIGN_ENDS_AT.getTime() - 60_000)
    expect(shouldShowHibpBanner(before, true)).toBe(false)
    const after = new Date(HIBP_CAMPAIGN_ENDS_AT.getTime() + 60_000)
    expect(shouldShowHibpBanner(after, false)).toBe(false)
  })
})
