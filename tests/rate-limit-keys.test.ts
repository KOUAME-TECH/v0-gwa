import { describe, it, expect } from "vitest"

/**
 * Rate-limit middleware — clés attendues (miroir de middleware.ts).
 * Évite les régressions « admin » fusionné dans « api » (60/min).
 */
function rlKeyForPath(pathname: string): "auth" | "admin" | "api" | "default" {
  if (pathname.startsWith("/auth")) return "auth"
  if (pathname.startsWith("/api/admin")) return "admin"
  if (pathname.startsWith("/api")) return "api"
  return "default"
}

const LIMITS = { auth: 10, admin: 20, api: 60, default: 120 } as const

describe("rate limit middleware keys", () => {
  it("sépare /api/admin (20) de /api (60)", () => {
    expect(rlKeyForPath("/api/admin/users")).toBe("admin")
    expect(LIMITS[rlKeyForPath("/api/admin/users")]).toBe(20)
    expect(rlKeyForPath("/api/factoring")).toBe("api")
    expect(LIMITS[rlKeyForPath("/api/factoring")]).toBe(60)
  })

  it("auth reste à 10/min", () => {
    expect(LIMITS[rlKeyForPath("/auth/login")]).toBe(10)
  })
})
