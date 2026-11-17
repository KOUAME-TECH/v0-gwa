import { describe, expect, it } from "vitest"
import { profileForAuthenticatedUser, type DisplayProfile } from "@/lib/auth/profile-display"

describe("profileForAuthenticatedUser", () => {
  const user = { id: "user-1", email: "user@example.test" }
  const profile: DisplayProfile = {
    id: "user-1",
    full_name: "Membre",
    email: "old@example.test",
    avatar_url: null,
    bio: null,
    user_type: "buyer",
    city: null,
    country: null,
    is_verified: false,
    rating: null,
  }

  it("affiche un profil minimal si la lecture du profil échoue ou ne renvoie aucune ligne", () => {
    expect(profileForAuthenticatedUser(user, null)).toMatchObject({
      id: user.id,
      email: user.email,
      full_name: "",
    })
  })

  it("utilise les données du bon profil et l'adresse du compte authentifié", () => {
    expect(profileForAuthenticatedUser(user, profile)).toMatchObject({
      full_name: "Membre",
      email: user.email,
    })
  })

  it("ne présente jamais les données d'un autre utilisateur", () => {
    const result = profileForAuthenticatedUser(user, { ...profile, id: "user-2" })
    expect(result.id).toBe(user.id)
    expect(result.full_name).toBe("")
  })
})
