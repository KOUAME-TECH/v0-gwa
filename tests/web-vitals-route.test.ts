import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/security/rate-limiter", () => ({
  rateLimit: vi.fn(async () => ({
    success: true,
    remaining: 59,
    resetAt: Date.now() + 60_000,
    blocked: false,
  })),
}))

describe("POST /api/metrics/web-vitals", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("accepte LCP anonymisé", async () => {
    const { POST } = await import("@/app/api/metrics/web-vitals/route")
    const res = await POST(
      new Request("http://localhost/api/metrics/web-vitals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "LCP", value: 1800, path: "/marketplace", rating: "good" }),
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it("rejette métrique inconnue", async () => {
    const { POST } = await import("@/app/api/metrics/web-vitals/route")
    const res = await POST(
      new Request("http://localhost/api/metrics/web-vitals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "HACK", value: 1, path: "/" }),
      }),
    )
    expect(res.status).toBe(400)
  })
})
