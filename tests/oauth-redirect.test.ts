import { describe, expect, it } from "vitest"
import {
  buildGoogleOAuthRedirectTo,
  safeOAuthNextPath,
} from "@/lib/auth/oauth"

describe("safeOAuthNextPath", () => {
  it("accepte un chemin relatif", () => {
    expect(safeOAuthNextPath("/profil")).toBe("/profil")
    expect(safeOAuthNextPath("/auth/onboarding")).toBe("/auth/onboarding")
  })

  it("rejette open-redirect", () => {
    expect(safeOAuthNextPath("https://evil.example")).toBeNull()
    expect(safeOAuthNextPath("//evil.example")).toBeNull()
    expect(safeOAuthNextPath(null)).toBeNull()
    expect(safeOAuthNextPath("")).toBeNull()
  })
})

describe("buildGoogleOAuthRedirectTo", () => {
  it("pointe vers /auth/callback sans next", () => {
    expect(buildGoogleOAuthRedirectTo("https://mygwa.org")).toBe(
      "https://mygwa.org/auth/callback",
    )
    expect(buildGoogleOAuthRedirectTo("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/callback",
    )
  })

  it("ajoute next encodé quand sûr", () => {
    expect(
      buildGoogleOAuthRedirectTo("https://mygwa.org", "/dashboard/buyer"),
    ).toBe(
      "https://mygwa.org/auth/callback?next=%2Fdashboard%2Fbuyer",
    )
  })

  it("ignore next dangereux", () => {
    expect(
      buildGoogleOAuthRedirectTo("https://mygwa.org", "//evil.example"),
    ).toBe("https://mygwa.org/auth/callback")
  })
})
