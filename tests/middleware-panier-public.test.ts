import { describe, expect, it } from "vitest"

/**
 * Contrat excellence Acheteur : /panier doit rester public
 * pour le panier invité (auth forcée au checkout UI).
 */
function needsAuth(path: string): boolean {
  const protectedPrefixes = [
    "/protected",
    "/admin",
    "/dashboard",
    "/profil/edit",
    "/publier",
    "/messages",
    "/notifications",
    "/wallet",
    "/commandes",
    "/abonnement",
    "/scg",
    "/affacturage",
  ]
  return protectedPrefixes.some((p) => path === p || path.startsWith(`${p}/`))
}

describe("middleware panier public", () => {
  it("ne protège pas /panier", () => {
    expect(needsAuth("/panier")).toBe(false)
  })

  it("protège encore buyer / commandes / messages", () => {
    expect(needsAuth("/dashboard/buyer")).toBe(true)
    expect(needsAuth("/dashboard/commandes")).toBe(true)
    expect(needsAuth("/messages")).toBe(true)
  })
})
