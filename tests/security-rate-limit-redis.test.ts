import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/security/upstash", () => ({
  hasUpstash: vi.fn(() => false),
  upstashGetBlocked: vi.fn(async () => null),
  upstashIncr: vi.fn(async () => null),
  upstashSetBlocked: vi.fn(async () => undefined),
}))

import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limiter"
import { hasUpstash } from "@/lib/security/upstash"

describe("rateLimit requireRedis (IA)", () => {
  beforeEach(() => {
    vi.mocked(hasUpstash).mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("YELLY_CHAT refuse sans Redis (fail-closed)", async () => {
    const res = await rateLimit("test:yelly", RATE_LIMITS.YELLY_CHAT)
    expect(res.success).toBe(false)
    expect(res.blocked).toBe(true)
    expect(RATE_LIMITS.YELLY_CHAT.maxRequests).toBe(10)
  })

  it("AI_ADVICE refuse sans Redis", async () => {
    const res = await rateLimit("test:ai", RATE_LIMITS.AI_ADVICE)
    expect(res.success).toBe(false)
    expect(RATE_LIMITS.AI_ADVICE.maxRequests).toBe(10)
  })

  it("API_GENERAL peut encore utiliser le fallback mémoire", async () => {
    const a = await rateLimit("test:general", RATE_LIMITS.API_GENERAL)
    expect(a.success).toBe(true)
  })
})
