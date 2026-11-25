import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import vm from "node:vm"

/** Charge le cœur du Service Worker dans un bac à sable et expose ses fonctions. */
function loadSw() {
  const src = readFileSync("public/gwa-sw-core.js", "utf8")
  const ctx: Record<string, unknown> = {
    self: { addEventListener: () => {}, location: { origin: "https://mygwa.org" } },
    caches: {},
    URL,
    Response,
    fetch: () => Promise.reject(new Error("offline")),
  }
  vm.createContext(ctx)
  vm.runInContext(`${src}\n;globalThis.__sw = { isPrivatePath, shouldBypassCache, CACHE }`, ctx)
  return ctx.__sw as {
    isPrivatePath: (p: string) => boolean
    shouldBypassCache: (req: Request, res?: Response) => boolean
    CACHE: string
  }
}

describe("Service Worker : aucune page privée en cache", () => {
  const sw = loadSw()
  it.each([
    "/profil",
    "/profil/edit",
    "/messages/abc",
    "/commandes/confirmation",
    "/wallet",
    "/admin/features",
    "/notifications",
    "/favoris",
    "/facture/123",
    "/publier",
    "/abonnement",
    "/scg",
    "/auth/reset-password",
  ])("%s est privée", (p) => {
    expect(sw.isPrivatePath(p)).toBe(true)
  })
  it.each(["/", "/marketplace", "/produit/1", "/conditions"])("%s reste publique", (p) => {
    expect(sw.isPrivatePath(p)).toBe(false)
  })
  it("ne met pas en cache une réponse marquée private/no-store", () => {
    const req = new Request("https://mygwa.org/marketplace")
    expect(sw.shouldBypassCache(req, new Response("x", { headers: { "Cache-Control": "private, no-store" } }))).toBe(true)
    expect(sw.shouldBypassCache(req, new Response("x", { headers: { "Cache-Control": "public, max-age=0" } }))).toBe(false)
  })
  it("version de cache incrémentée (purge des anciens caches)", () => {
    expect(sw.CACHE).toBe("gwa-v23-offline")
  })
})
