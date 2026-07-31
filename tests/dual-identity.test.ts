import { describe, it, expect } from "vitest"
import {
  canonicalProductUserType,
  hasProductAccount,
  isDualIdentity,
  productEspaceLabel,
  productEspacePath,
  USER_TYPE_MAP,
} from "@/lib/auth/dual-identity"

describe("dual-identity (admin vs compte métier)", () => {
  it("mappe les rôles hérités", () => {
    expect(USER_TYPE_MAP.farmer).toBe("producteur")
    expect(USER_TYPE_MAP.buyer).toBe("acheteur")
  })

  it("détecte un compte produit", () => {
    expect(hasProductAccount("producteur")).toBe(true)
    expect(hasProductAccount("farmer")).toBe(true)
    expect(hasProductAccount("acheteur")).toBe(true)
    expect(hasProductAccount(null)).toBe(false)
    expect(hasProductAccount("admin")).toBe(false)
  })

  it("canonicalProductUserType", () => {
    expect(canonicalProductUserType("transformateur")).toBe("producteur")
    expect(canonicalProductUserType("entreprise")).toBe("acheteur")
    expect(canonicalProductUserType("cooperative")).toBe("cooperative")
  })

  it("isDualIdentity uniquement si admin + métier", () => {
    expect(isDualIdentity(true, "producteur")).toBe(true)
    expect(isDualIdentity(true, null)).toBe(false)
    expect(isDualIdentity(false, "producteur")).toBe(false)
  })

  it("libellés / chemins espace métier", () => {
    expect(productEspaceLabel("producteur")).toBe("Espace producteur")
    expect(productEspacePath("cooperative")).toBe("/dashboard/cooperative")
    expect(productEspacePath("acheteur")).toBe("/dashboard/buyer")
  })
})
