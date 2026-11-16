import { describe, expect, it } from "vitest"
import { destinationForProfile } from "@/lib/auth/post-auth"
import { loginHref, safeInternalPath } from "@/lib/auth/oauth"

describe("destinationForProfile", () => {
  it("envoie un acheteur nommé vers son espace, même sans sous-type", () => {
    expect(
      destinationForProfile({ userType: "acheteur", fullName: "Awa" }),
    ).toEqual({ path: "/dashboard/buyer", isNewUser: false })
  })

  it("envoie un producteur nommé vers son espace", () => {
    expect(
      destinationForProfile({ userType: "producteur", fullName: "Konan" }),
    ).toEqual({ path: "/dashboard/farmer", isNewUser: false })
  })

  it("demande le nom si le rôle existe déjà", () => {
    expect(
      destinationForProfile({ userType: "cooperative", fullName: "  " }),
    ).toEqual({ path: "/auth/signup?resume=onboarding", isNewUser: true })
  })

  it("ouvre l'onboarding seulement sans rôle", () => {
    expect(destinationForProfile({ userType: null, fullName: null })).toEqual({
      path: "/auth/onboarding",
      isNewUser: true,
    })
  })

  it("ouvre le backoffice pour un admin sans compte métier", () => {
    expect(destinationForProfile({ isAdmin: true, userType: null, fullName: "Ops" })).toEqual({
      path: "/admin",
      isNewUser: false,
    })
  })

  it("laisse un admin qui vend entrer dans l'espace producteur", () => {
    expect(
      destinationForProfile({
        isAdmin: true,
        userType: "producteur",
        fullName: "Yao",
      }),
    ).toEqual({ path: "/dashboard/farmer", isNewUser: false })
  })
})

describe("safeInternalPath", () => {
  it("garde un retour interne avec query", () => {
    expect(safeInternalPath("/messages?to=abc")).toBe("/messages?to=abc")
  })

  it("refuse une boucle vers la connexion et une URL externe", () => {
    expect(safeInternalPath("/auth/login?redirect=/admin")).toBeNull()
    expect(safeInternalPath("https://evil.example")).toBeNull()
    expect(safeInternalPath("/\\evil.example")).toBeNull()
  })

  it("construit le lien de connexion", () => {
    expect(loginHref("/profil")).toBe("/auth/login?redirect=%2Fprofil")
    expect(loginHref("//evil.example")).toBe("/auth/login?redirect=%2Fprofil")
  })
})
