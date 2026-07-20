import { describe, it, expect } from "vitest"
import { dashboardPathForUserType, isSellerRole } from "@/lib/dashboard/routing"

describe("mapping rôle → dashboard (P2/P11)", () => {
  it("coopérative → espace coopérative", () => {
    expect(dashboardPathForUserType("cooperative")).toBe("/dashboard/cooperative")
  })

  it("producteur et libellés hérités → espace producteur", () => {
    expect(dashboardPathForUserType("producteur")).toBe("/dashboard/farmer")
    expect(dashboardPathForUserType("farmer")).toBe("/dashboard/farmer")
    expect(dashboardPathForUserType("transformateur")).toBe("/dashboard/farmer")
    expect(dashboardPathForUserType("artisan")).toBe("/dashboard/farmer")
  })

  it("acheteur et inconnu → espace acheteur", () => {
    expect(dashboardPathForUserType("acheteur")).toBe("/dashboard/buyer")
    expect(dashboardPathForUserType("buyer")).toBe("/dashboard/buyer")
    expect(dashboardPathForUserType(null)).toBe("/dashboard/buyer")
    expect(dashboardPathForUserType("n'importe quoi")).toBe("/dashboard/buyer")
  })

  it("isSellerRole distingue vendeurs et acheteurs", () => {
    expect(isSellerRole("producteur")).toBe(true)
    expect(isSellerRole("cooperative")).toBe(true)
    expect(isSellerRole("acheteur")).toBe(false)
  })
})
