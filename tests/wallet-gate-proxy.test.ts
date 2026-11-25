import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const flag = { enabled: false }
const updateSession = vi.fn(async () => NextResponse.next())

vi.mock("@/lib/supabase/middleware", () => ({ updateSession }))
vi.mock("@/lib/feature-flags/core", async (orig) => {
  const actual = await orig<typeof import("@/lib/feature-flags/core")>()
  return { ...actual, fetchFeatureFlag: async () => flag.enabled }
})

describe("proxy — wallet masqué", () => {
  beforeEach(() => {
    flag.enabled = false
    updateSession.mockClear()
  })

  it("/wallet redirige vers /dashboard quand le drapeau est off", async () => {
    const { proxy } = await import("@/proxy")
    const res = await proxy(new NextRequest("https://mygwa.org/wallet?tab=x"))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://mygwa.org/dashboard")
    expect(updateSession).not.toHaveBeenCalled()
  })

  it("/payout redirige aussi", async () => {
    const { proxy } = await import("@/proxy")
    const res = await proxy(new NextRequest("https://mygwa.org/payout"))
    expect(res.headers.get("location")).toBe("https://mygwa.org/dashboard")
  })

  it("/payout et /wallet : redirection marquée private, no-store (jamais public)", async () => {
    const { proxy } = await import("@/proxy")
    for (const path of ["/payout", "/payout/demande", "/wallet"]) {
      const res = await proxy(new NextRequest(`https://mygwa.org${path}`))
      expect(res.headers.get("cache-control"), path).toBe("private, no-store")
    }
    const api = await proxy(new NextRequest("https://mygwa.org/api/payout/request"))
    expect(api.headers.get("cache-control")).toBe("private, no-store")
  })

  it("/api/wallet/withdraw répond 404 JSON", async () => {
    const { proxy } = await import("@/proxy")
    const res = await proxy(new NextRequest("https://mygwa.org/api/wallet/withdraw"))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "FEATURE_DISABLED" })
  })

  it("drapeau on → /wallet passe à la session normale", async () => {
    flag.enabled = true
    const { proxy } = await import("@/proxy")
    await proxy(new NextRequest("https://mygwa.org/wallet"))
    expect(updateSession).toHaveBeenCalledTimes(1)
  })

  it("les routes hors wallet ne sont pas touchées", async () => {
    const { proxy } = await import("@/proxy")
    await proxy(new NextRequest("https://mygwa.org/marketplace"))
    expect(updateSession).toHaveBeenCalledTimes(1)
  })
})
