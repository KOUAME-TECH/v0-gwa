import { describe, expect, it } from "vitest"
import { mapAuthErrorMessage } from "@/lib/auth/auth-errors"

describe("mapAuthErrorMessage", () => {
  it("traduit un mot de passe leaked / HaveIBeenPwned", () => {
    expect(mapAuthErrorMessage("Password has been leaked.")).toMatch(/compromis/i)
  })

  it("traduit invalid login credentials", () => {
    expect(mapAuthErrorMessage("Invalid login credentials")).toBe(
      "Email ou mot de passe incorrect",
    )
  })

  it("masque un message fournisseur inconnu", () => {
    expect(mapAuthErrorMessage("Something weird")).toBe(
      "Connexion impossible. Réessayez, ou utilisez un autre moyen.",
    )
  })

  it("explique un provider Google non activé", () => {
    expect(mapAuthErrorMessage("Unsupported provider: provider is not enabled")).toMatch(
      /Google/i,
    )
  })
})
