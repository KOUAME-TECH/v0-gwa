import { describe, expect, it } from "vitest"
import {
  classifySession,
  hasSupabaseAuthCookie,
  isTransientNetworkError,
} from "@/lib/auth/session-state"
import { profileFromRow } from "@/lib/profile/self"

describe("hasSupabaseAuthCookie", () => {
  it("reconnaît le cookie de session et ses chunks", () => {
    expect(
      hasSupabaseAuthCookie([
        { name: "sb-frorfexbcyfbydkiwxqv-auth-token", value: "base64" },
      ]),
    ).toBe(true)
    expect(
      hasSupabaseAuthCookie([
        { name: "sb-frorfexbcyfbydkiwxqv-auth-token.0", value: "chunk" },
      ]),
    ).toBe(true)
  })

  it("ignore un cookie vide ou étranger", () => {
    expect(
      hasSupabaseAuthCookie([
        { name: "sb-frorfexbcyfbydkiwxqv-auth-token", value: "" },
        { name: "gwa-theme", value: "light" },
      ]),
    ).toBe(false)
  })
})

describe("classifySession", () => {
  it("reste connecté dès qu'un utilisateur est lu", () => {
    expect(
      classifySession({ hasAuthCookie: true, hasUser: true, transientError: false }),
    ).toBe("authenticated")
  })

  it("ne traite pas un timeout avec cookie comme une déconnexion", () => {
    expect(
      classifySession({ hasAuthCookie: true, hasUser: false, transientError: true }),
    ).toBe("unavailable")
  })

  it("est anonyme sans cookie, même si le réseau a bougé", () => {
    expect(
      classifySession({ hasAuthCookie: false, hasUser: false, transientError: true }),
    ).toBe("anonymous")
    expect(
      classifySession({ hasAuthCookie: false, hasUser: false, transientError: false }),
    ).toBe("anonymous")
  })

  it("est anonyme si le cookie est là mais la session est refusée", () => {
    expect(
      classifySession({ hasAuthCookie: true, hasUser: false, transientError: false }),
    ).toBe("anonymous")
  })
})

describe("isTransientNetworkError", () => {
  it("reconnaît un timeout et un fetch coupé", () => {
    expect(isTransientNetworkError({ message: "Failed to fetch" })).toBe(true)
    expect(isTransientNetworkError({ message: "Request timed out", status: 504 })).toBe(true)
    expect(isTransientNetworkError({ name: "AuthRetryableFetchError", message: "" })).toBe(true)
  })

  it("ne masque pas un refus d'identifiants", () => {
    expect(isTransientNetworkError({ message: "Invalid login credentials", status: 400 })).toBe(
      false,
    )
    expect(isTransientNetworkError(null)).toBe(false)
  })
})

describe("profileFromRow", () => {
  it("garde le nom et l'email auth si la ligne est incomplète", () => {
    expect(
      profileFromRow({}, { id: "user-1", email: "awa@gwa.ci" }).full_name,
    ).toBe("Utilisateur GWA")
    expect(profileFromRow({ full_name: "Awa Konan" }, { id: "user-1", email: "awa@gwa.ci" })).toMatchObject({
      id: "user-1",
      full_name: "Awa Konan",
      email: "awa@gwa.ci",
    })
  })
})
