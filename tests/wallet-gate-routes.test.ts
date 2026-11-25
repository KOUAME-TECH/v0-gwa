import { describe, it, expect, vi, beforeEach } from "vitest"

const flag = { enabled: false }
const requireUser = vi.fn(async () => ({ user: { id: "u1" }, error: null }))
const createAdminClient = vi.fn(() => {
  throw new Error("ne doit pas être appelé quand le wallet est masqué")
})

vi.mock("@/lib/feature-flags/server", async () => {
  const { NextResponse } = await import("next/server")
  return {
    isWalletEnabled: async () => flag.enabled,
    walletDisabledResponse: () =>
      NextResponse.json({ error: "Fonctionnalité indisponible", code: "FEATURE_DISABLED" }, { status: 404 }),
  }
})
vi.mock("@/lib/auth/require-admin", () => ({ requireUser }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit: async () => ({ success: true, remaining: 1, resetAt: 0, blocked: false }),
}))

describe("/api/wallet/withdraw — drapeau wallet off", () => {
  beforeEach(() => {
    flag.enabled = false
    requireUser.mockClear()
    createAdminClient.mockClear()
  })

  it("GET répond 404 FEATURE_DISABLED sans lire la base", async () => {
    const { GET } = await import("@/app/api/wallet/withdraw/route")
    const res = await GET()
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "FEATURE_DISABLED" })
    expect(requireUser).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("POST répond 404 sans créer de demande de retrait", async () => {
    const { POST } = await import("@/app/api/wallet/withdraw/route")
    const req = new Request("https://gwa.test/api/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount: 5000, phone: "0000000000" }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(404)
    expect(requireUser).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it("drapeau on → la route reprend son comportement (auth requise)", async () => {
    flag.enabled = true
    requireUser.mockResolvedValueOnce({ user: null, error: "Non authentifié" } as never)
    const { GET } = await import("@/app/api/wallet/withdraw/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
