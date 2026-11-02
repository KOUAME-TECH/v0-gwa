import { describe, it, expect } from "vitest"
import { trackFarmerEvent } from "@/lib/farmer/observability"

describe("farmer observability", () => {
  it("n’explose pas sans Sentry", () => {
    expect(() =>
      trackFarmerEvent("farmer.dashboard.load", {
        products: 2,
        email: "secret@example.com",
        phone: "0700000000",
      }),
    ).not.toThrow()
  })
})
