import { describe, expect, it, vi, beforeEach } from "vitest"
import { trackBuyerEvent } from "@/lib/buyer/observability"

describe("trackBuyerEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      Sentry: { addBreadcrumb: vi.fn() },
    })
  })

  it("émet un breadcrumb sans PII", () => {
    trackBuyerEvent("buyer.checkout.start", {
      lines: 2,
      phone: "+22507000000",
      user: "secret-id",
    })
    const add = (window as unknown as { Sentry: { addBreadcrumb: ReturnType<typeof vi.fn> } })
      .Sentry.addBreadcrumb
    expect(add).toHaveBeenCalled()
    const arg = add.mock.calls[0][0] as { data: Record<string, unknown>; message: string }
    expect(arg.message).toBe("buyer.checkout.start")
    expect(arg.data.lines).toBe(2)
    expect(arg.data.phone).toBeUndefined()
    expect(arg.data.user).toBeUndefined()
  })
})
