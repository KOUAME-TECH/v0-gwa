import { describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "203.0.113.50" }),
}))

import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limiter"
import { hasUpstash } from "@/lib/security/upstash"

const hasKv = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
)

describe.skipIf(!hasKv)("HTTP-equivalent YELLY rate limit with Redis", () => {
  it("hasUpstash true when KV set", () => {
    expect(hasUpstash()).toBe(true)
  })

  it("returns fail after 10 within window (maps to HTTP 429)", async () => {
    const key = `yelly:203.0.113.50:audit-${Date.now()}`
    const codes: number[] = []
    for (let i = 0; i < 20; i++) {
      const r = await rateLimit(key, RATE_LIMITS.YELLY_CHAT)
      codes.push(r.success ? 200 : 429)
    }
    expect(codes.filter((c) => c === 200)).toHaveLength(10)
    expect(codes.filter((c) => c === 429)).toHaveLength(10)
    expect(codes[10]).toBe(429)
  })
})
