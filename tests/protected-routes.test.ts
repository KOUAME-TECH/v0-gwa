import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { readFileSync } from "node:fs"
import {
  PROTECTED_PREFIXES,
  isProtectedPath,
  isPublicProfilePath,
} from "@/lib/auth/protected-routes"
import { PRIVATE_ROUTE_PREFIXES } from "@/lib/routes/private-prefixes.mjs"

const auth = { user: null as { id: string } | null }
const getUser = vi.fn(async () => ({ data: { user: auth.user }, error: null }))

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

describe("routes protégées", () => {
  it.each(["/profil", "/profil/", "/profil/edit", "/profil/lier", "/profil/verification", "/dashboard", "/payout", "/wallet/x"])(
    "%s exige une session",
    (p) => expect(isProtectedPath(p)).toBe(true),
  )
  it.each(["/", "/marketplace", "/profil/3f1c9a", "/profile", "/profilx"])("%s reste public", (p) =>
    expect(isProtectedPath(p)).toBe(false),
  )
  it("profil public d'un membre : chemin rapide sans session", () => {
    expect(isPublicProfilePath("/profil/3f1c9a")).toBe(true)
    expect(isPublicProfilePath("/profil/edit")).toBe(false)
    expect(isPublicProfilePath("/profil")).toBe(false)
  })
  it("toute route protégée est aussi en Cache-Control private, no-store", () => {
    for (const p of PROTECTED_PREFIXES) {
      const root = `/${p.split("/")[1]}`
      expect(PRIVATE_ROUTE_PREFIXES, p).toContain(root)
    }
  })
})

describe("updateSession — visiteur anonyme", () => {
  beforeEach(() => {
    auth.user = null
    getUser.mockClear()
  })

  it.each(["/profil", "/dashboard", "/profil/edit"])("%s → 307 vers /auth/login", async (p) => {
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(new NextRequest(`https://mygwa.org${p}`))
    expect(res.status).toBe(307)
    const loc = new URL(res.headers.get("location") || "")
    expect(loc.pathname).toBe("/auth/login")
    expect(loc.searchParams.get("redirect")).toBe(p)
  })

  it("/profil/<id> public : pas de redirection ni de lecture de session", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(new NextRequest("https://mygwa.org/profil/3f1c9a"))
    expect(res.headers.get("location")).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })

  it("connecté : /profil passe", async () => {
    auth.user = { id: "u-1" }
    const { updateSession } = await import("@/lib/supabase/middleware")
    const res = await updateSession(new NextRequest("https://mygwa.org/profil"))
    expect(res.headers.get("location")).toBeNull()
  })

  it("la page /profil redirige elle aussi côté serveur (défense en profondeur)", () => {
    const src = readFileSync("app/profil/page.tsx", "utf8")
    expect(src).toMatch(/redirect\("\/auth\/login\?redirect=%2Fprofil"\)/)
  })
})
