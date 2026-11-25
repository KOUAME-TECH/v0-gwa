import { describe, expect, it, vi } from "vitest"
import { resolveClientIp, resolveClientIpOrNull } from "@/lib/security/client-ip"

const h = (o: Record<string, string>) => new Headers(o)

// IP fictives (plages de documentation).
describe("resolveClientIp", () => {
  it("x-vercel-forwarded-for en priorité (posé par Vercel)", () => {
    expect(
      resolveClientIp(
        h({
          "x-vercel-forwarded-for": "203.0.113.5",
          "x-real-ip": "203.0.113.9",
          "x-forwarded-for": "198.51.100.66, 203.0.113.5",
        }),
      ),
    ).toBe("203.0.113.5")
  })

  it("sinon x-real-ip", () => {
    expect(resolveClientIp(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.66, 203.0.113.9" }))).toBe(
      "203.0.113.9",
    )
  })

  it("sans en-tête fiable : DERNIÈRE entrée de x-forwarded-for, jamais la première (falsifiable)", () => {
    expect(resolveClientIp(h({ "x-forwarded-for": "1.2.3.4, 198.51.100.66 , 203.0.113.7" }))).toBe("203.0.113.7")
  })

  it("un client qui forge la première entrée ne change pas son identité", () => {
    const a = resolveClientIp(h({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }))
    const b = resolveClientIp(h({ "x-forwarded-for": "10.0.0.2, 203.0.113.7" }))
    expect(a).toBe(b)
  })

  it("cf-connecting-ip n'est plus cru (pas de Cloudflare devant Vercel)", () => {
    expect(resolveClientIp(h({ "cf-connecting-ip": "1.2.3.4", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9")
    expect(resolveClientIp(h({ "cf-connecting-ip": "1.2.3.4" }))).toBe("unknown")
  })

  it("valeurs vides ou invalides ignorées ; rien → unknown / null", () => {
    expect(resolveClientIp(h({ "x-real-ip": "  ", "x-forwarded-for": "203.0.113.7," }))).toBe("203.0.113.7")
    expect(resolveClientIp(h({ "x-real-ip": "a".repeat(60) }))).toBe("unknown")
    expect(resolveClientIp(h({}))).toBe("unknown")
    expect(resolveClientIpOrNull(h({}))).toBeNull()
    expect(resolveClientIpOrNull(h({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1")
  })
})

describe("getClientIdentifier (rate-limit) suit la même règle", () => {
  it("prend la dernière entrée de x-forwarded-for", async () => {
    vi.resetModules()
    vi.doMock("next/headers", () => ({
      headers: async () => h({ "x-forwarded-for": "6.6.6.6, 203.0.113.42" }),
    }))
    const { getClientIdentifier } = await import("@/lib/security/rate-limiter")
    expect(await getClientIdentifier()).toBe("203.0.113.42")
    vi.doUnmock("next/headers")
  })
})
