import { describe, it, expect } from "vitest"
import { shouldShowBottomNav } from "@/lib/navigation/shell-routes"
import { authorizeCronRequest, getCronSecret } from "@/lib/security/cron-auth"
import {
  getOneSignalAppId,
  GWA_ONESIGNAL_APP_ID,
} from "@/lib/notifications/onesignal-config"

describe("shouldShowBottomNav", () => {
  it("affiche sur shell principal", () => {
    expect(shouldShowBottomNav("/")).toBe(true)
    expect(shouldShowBottomNav("/marketplace")).toBe(true)
    expect(shouldShowBottomNav("/agriculture")).toBe(true)
    expect(shouldShowBottomNav("/produit/abc")).toBe(true)
    expect(shouldShowBottomNav("/messages")).toBe(true)
    expect(shouldShowBottomNav("/profil")).toBe(true)
    expect(shouldShowBottomNav("/recherche")).toBe(true)
    expect(shouldShowBottomNav("/publier")).toBe(true)
  })

  it("masque sur les autres pages", () => {
    expect(shouldShowBottomNav("/cooperatives")).toBe(false)
    expect(shouldShowBottomNav("/conditions")).toBe(false)
    expect(shouldShowBottomNav("/auth/login")).toBe(false)
    expect(shouldShowBottomNav("/admin")).toBe(false)
    expect(shouldShowBottomNav("/wallet")).toBe(false)
    expect(shouldShowBottomNav("/messages/xyz")).toBe(false)
    expect(shouldShowBottomNav("/download")).toBe(false)
    expect(shouldShowBottomNav("/profil/lier")).toBe(false)
    expect(shouldShowBottomNav("/profil/verification")).toBe(false)
  })
})

describe("OneSignal App ID", () => {
  it("fallback GWA toujours valide", () => {
    expect(GWA_ONESIGNAL_APP_ID).toBe("5f01e343-a7a2-4ae8-8baa-655388e239bc")
    expect(getOneSignalAppId()).toBeTruthy()
  })
})

describe("cron auth", () => {
  it("accepte Bearer secret", () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = "test-secret"
    const req = new Request("https://x/api/cron", {
      headers: { authorization: "Bearer test-secret" },
    })
    expect(authorizeCronRequest(req)).toEqual({ ok: true, via: "bearer" })
    process.env.CRON_SECRET = prev
  })

  it("accepte x-vercel-cron en secours", () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = "other"
    const req = new Request("https://x/api/cron", {
      headers: { "x-vercel-cron": "1" },
    })
    expect(authorizeCronRequest(req)).toEqual({ ok: true, via: "vercel-cron" })
    process.env.CRON_SECRET = prev
  })

  it("refuse sans auth", () => {
    const prev = process.env.CRON_SECRET
    const prevEnv = process.env.NODE_ENV
    process.env.CRON_SECRET = "x"
    process.env.NODE_ENV = "production"
    const req = new Request("https://x/api/cron")
    expect(authorizeCronRequest(req).ok).toBe(false)
    process.env.CRON_SECRET = prev
    process.env.NODE_ENV = prevEnv
  })

  it("getCronSecret trim quotes", () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = '"abc"'
    expect(getCronSecret()).toBe("abc")
    process.env.CRON_SECRET = prev
  })
})
