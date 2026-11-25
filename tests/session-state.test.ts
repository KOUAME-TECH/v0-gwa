import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  classifySession,
  hasSupabaseAuthCookie,
  isTransientNetworkError,
  shouldRedirectToLogin,
  TRANSIENT_AUTH_RETRY_LIMIT,
} from "@/lib/auth/session-state"
import { profileFromRow } from "@/lib/profile/self"

const require = createRequire(fileURLToPath(import.meta.url))
const supabaseEntry = require.resolve("@supabase/supabase-js")
const { AuthRetryableFetchError } = require(join(dirname(supabaseEntry), "../../auth-js")) as {
  AuthRetryableFetchError: new (message: string, status?: number) => Error & {
    status?: number
  }
}

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
  it("reconnaît un timeout, un fetch coupé et les statuts passerelle", () => {
    expect(isTransientNetworkError({ message: "Failed to fetch" })).toBe(true)
    expect(isTransientNetworkError({ message: "Request timed out", status: 504 })).toBe(true)
    expect(isTransientNetworkError({ name: "AuthRetryableFetchError", message: "" })).toBe(true)
    expect(isTransientNetworkError({ message: "fetch failed", status: 0 })).toBe(true)
    expect(isTransientNetworkError({ message: "econnreset" })).toBe(true)
    for (const status of [408, 502, 503, 504, 522, 524]) {
      expect(isTransientNetworkError({ message: "gateway", status })).toBe(true)
    }
  })

  it("ne masque pas un refus, une 500 durable, ni un message abort", () => {
    expect(isTransientNetworkError({ message: "Invalid login credentials", status: 400 })).toBe(
      false,
    )
    expect(isTransientNetworkError(null)).toBe(false)
    expect(isTransientNetworkError({ message: "Internal Server Error", status: 500 })).toBe(false)
    expect(isTransientNetworkError({ status: 500 })).toBe(false)
    expect(
      isTransientNetworkError({
        name: "AuthRetryableFetchError",
        message: "network timeout",
        status: 500,
      }),
    ).toBe(false)
    expect(isTransientNetworkError({ message: "The user aborted a request" })).toBe(false)
    expect(isTransientNetworkError({ message: "statement aborted" })).toBe(false)
    expect(
      isTransientNetworkError({ name: "AbortError", message: "This operation was aborted" }),
    ).toBe(false)
  })

  it("ignore le nom AuthRetryableFetchError quand le statut HTTP est positif", () => {
    const denied = new AuthRetryableFetchError("Internal Server Error", 500)
    expect(denied.name).toBe("AuthRetryableFetchError")
    expect(denied.status).toBe(500)
    expect(isTransientNetworkError(denied)).toBe(false)
    expect(
      shouldRedirectToLogin({ needsAuth: true, hasUser: false, error: denied }),
    ).toBe(true)

    const gateway = new AuthRetryableFetchError("Gateway Timeout", 504)
    expect(isTransientNetworkError(gateway)).toBe(true)
    expect(
      shouldRedirectToLogin({ needsAuth: true, hasUser: false, error: gateway }),
    ).toBe(false)

    expect(isTransientNetworkError(new AuthRetryableFetchError("Failed to fetch", 0))).toBe(true)
    expect(isTransientNetworkError({ status: 0 })).toBe(true)
  })

  it("garde un abort qui est aussi un timeout réseau", () => {
    expect(
      isTransientNetworkError({ message: "The operation was aborted due to timeout" }),
    ).toBe(true)
  })

  it("ne relance qu'une fois", () => {
    expect(TRANSIENT_AUTH_RETRY_LIMIT).toBe(1)
  })
})

describe("shouldRedirectToLogin", () => {
  it("redirige sur une 500 ou un abort, pas sur un timeout", () => {
    expect(
      shouldRedirectToLogin({
        needsAuth: true,
        hasUser: false,
        error: { message: "Internal Server Error", status: 500 },
      }),
    ).toBe(true)
    expect(
      shouldRedirectToLogin({
        needsAuth: true,
        hasUser: false,
        error: { message: "The user aborted a request" },
      }),
    ).toBe(true)
    expect(
      shouldRedirectToLogin({
        needsAuth: true,
        hasUser: false,
        error: { message: "Request timed out", status: 504 },
      }),
    ).toBe(false)
    expect(
      shouldRedirectToLogin({
        needsAuth: true,
        hasUser: true,
        error: { status: 500 },
      }),
    ).toBe(false)
    expect(
      shouldRedirectToLogin({
        needsAuth: false,
        hasUser: false,
        error: { status: 500 },
      }),
    ).toBe(false)
  })

  it("classe une 500 avec cookie comme anonyme, donc la redirection reste active", () => {
    const error = { message: "Internal Server Error", status: 500 }
    expect(isTransientNetworkError(error)).toBe(false)
    expect(
      classifySession({
        hasAuthCookie: true,
        hasUser: false,
        transientError: isTransientNetworkError(error),
      }),
    ).toBe("anonymous")
  })
})

describe("profileFromRow", () => {
  it("garde le nom si la ligne est incomplète, sans recopier email ni téléphone", () => {
    expect(
      profileFromRow({}, { id: "user-1", email: "awa@gwa.ci" }).full_name,
    ).toBe("Utilisateur GWA")
    const profile = profileFromRow(
      {
        full_name: "Awa Konan",
        email: "secret@gwa.ci",
        phone: "+22500000000",
        linked_email: "secret@gwa.ci",
        phone_verified: true,
      },
      { id: "user-1", email: "awa@gwa.ci" },
    )
    expect(profile).toMatchObject({
      id: "user-1",
      full_name: "Awa Konan",
    })
    expect(profile).not.toHaveProperty("email")
    expect(profile).not.toHaveProperty("phone")
    expect(profile).not.toHaveProperty("linked_email")
    expect(profile).not.toHaveProperty("phone_verified")
  })
})
