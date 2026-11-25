/**
 * En-têtes next.config : no-store sur les pages privées / de session, et
 * connect-src CSP (Sentry, GeniusPay). Vérifié aussi par curl sur `next start`.
 */
import { describe, it, expect } from "vitest"
import nextConfig, { PRIVATE_NO_STORE, PRIVATE_NO_STORE_PREFIXES } from "../next.config.mjs"

type HeaderRule = { source: string; headers: { key: string; value: string }[] }

async function rules(): Promise<HeaderRule[]> {
  const cfg = nextConfig as unknown as { headers: () => Promise<HeaderRule[]> }
  return cfg.headers()
}

function headerFor(all: HeaderRule[], source: string, key: string): string | undefined {
  const r = all.find((x) => x.source === source)
  return r?.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value
}

describe("Cache-Control private, no-store", () => {
  it("couvre les pages privées historiques (#58) et les ajouts QA Lot C", () => {
    for (const p of [
      "/profil",
      "/admin",
      "/dashboard",
      "/wallet",
      "/messages",
      "/panier",
      "/commandes",
      "/notifications",
      "/publier",
      "/favoris",
      "/auth",
    ]) {
      expect(PRIVATE_NO_STORE_PREFIXES).toContain(p)
    }
    expect(PRIVATE_NO_STORE).toBe("private, no-store")
  })

  it("pose l'en-tête sur la page et ses sous-chemins (dont /auth/login)", async () => {
    const all = await rules()
    for (const p of PRIVATE_NO_STORE_PREFIXES) {
      expect(headerFor(all, p, "Cache-Control"), p).toBe("private, no-store")
      expect(headerFor(all, `${p}/:path*`, "Cache-Control"), `${p}/:path*`).toBe("private, no-store")
    }
  })

  it("ne touche pas les pages publiques en cache (marketplace)", async () => {
    const all = await rules()
    expect(all.some((r) => r.source.startsWith("/marketplace"))).toBe(false)
  })
})

describe("CSP connect-src", () => {
  it("autorise Sentry et GeniusPay sans retirer l'existant", async () => {
    const all = await rules()
    const csp = headerFor(all, "/(.*)", "Content-Security-Policy") || ""
    const connect = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("connect-src")) || ""
    const sources = connect.split(/\s+/)
    for (const s of [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://*.sentry.io",
      "https://*.ingest.sentry.io",
      "https://*.geniuspay.ci",
    ]) {
      expect(sources).toContain(s)
    }
    expect(csp).toMatch(/object-src 'none'/)
    expect(csp).not.toMatch(/unsafe-eval/)
  })
})
