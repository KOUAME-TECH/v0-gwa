// @ts-nocheck
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  isOneSignalOriginAllowed,
  GWA_ONESIGNAL_ALLOWED_ORIGINS,
} from "@/lib/notifications/onesignal-config"

const root = process.cwd()

function readPublic(name: string) {
  return readFileSync(join(root, "public", name), "utf8")
}

describe("Service workers v22 — message sync + pass-through", () => {
  const workers = [
    "OneSignalSDKWorker.js",
    "OneSignalSDKUpdaterWorker.js",
    "sw.js",
  ]

  for (const name of workers) {
    it(`${name} force sync setTimeout(0) before importScripts (message listeners)`, () => {
      const src = readPublic(name)
      expect(src).toMatch(/gwaSetTimeout|gwaSyncDeferredSwInit/)
      expect(src).toMatch(/delay === 0/)
      expect(src).toMatch(/importScripts\("https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\/OneSignalSDK\.sw\.js"\)/)
      expect(src).toMatch(/addEventListener\("message"/)
      expect(src).toMatch(/gwa-v22-offline/)
    })

    it(`${name} pass-through cross-origin / supabase / staticmap`, () => {
      const src = readPublic(name)
      expect(src).toMatch(/shouldPassThrough/)
      expect(src).toMatch(/supabase\.co/)
      expect(src).toMatch(/staticmap\.openstreetmap\.de/)
      expect(src).toMatch(/url\.origin !== self\.location\.origin/)
    })
  }
})

describe("CSP headers — staticmap", () => {
  it("connect-src et img-src autorisent staticmap.openstreetmap.de", () => {
    const cfg = readFileSync(join(root, "next.config.mjs"), "utf8")
    expect(cfg).toMatch(/staticmap\.openstreetmap\.de/)
    expect(cfg).toMatch(/connect-src[^"]*staticmap\.openstreetmap\.de/)
    expect(cfg).toMatch(/img-src[^"]*staticmap\.openstreetmap\.de/)
  })
})

describe("OneSignal allowlist exported", () => {
  it("inclut mygwa + preview vercel", () => {
    expect(GWA_ONESIGNAL_ALLOWED_ORIGINS).toContain("https://mygwa.org")
    expect(GWA_ONESIGNAL_ALLOWED_ORIGINS).toContain("https://v0-gwa-gwa.vercel.app")
    expect(isOneSignalOriginAllowed("https://v0-gwa-abc123.vercel.app")).toBe(true)
  })
})
