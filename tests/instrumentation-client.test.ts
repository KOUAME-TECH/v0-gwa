import { beforeEach, describe, expect, it, vi } from "vitest"
import { existsSync, readFileSync } from "node:fs"

const init = vi.fn()
const replayIntegration = vi.fn((opts: unknown) => ({ name: "Replay", opts }))
const captureRouterTransitionStart = vi.fn()
vi.mock("@sentry/nextjs", () => ({ init, replayIntegration, captureRouterTransitionStart }))

describe("instrumentation-client.ts (Next 16, navigateur)", () => {
  beforeEach(() => {
    init.mockClear()
  })

  it("initialise Sentry + Replay masqué, sans PII, avec nettoyage", async () => {
    const mod = await import("../instrumentation-client")
    expect(init).toHaveBeenCalledTimes(1)
    const cfg = init.mock.calls[0][0]
    expect(cfg.sendDefaultPii).toBe(false)
    expect(cfg.environment).toBe(process.env.NODE_ENV)
    expect(cfg.replaysSessionSampleRate).toBe(0.05)
    expect(cfg.replaysOnErrorSampleRate).toBe(1)
    expect(replayIntegration).toHaveBeenCalledWith({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })
    expect(typeof mod.onRouterTransitionStart).toBe("function")

    // beforeSend applique scrubSentryEvent : e-mail et téléphone retirés.
    const out = cfg.beforeSend({
      message: "contact awa@example.com au +225 07 12 34 56 78",
      user: { email: "awa@example.com", ip_address: "1.2.3.4" },
    })
    const json = JSON.stringify(out)
    expect(json).not.toContain("awa@example.com")
    expect(json).not.toContain("07 12 34 56 78")
    expect(json).not.toContain("1.2.3.4")
  })

  it("une seule config navigateur (pas de double init) et environment côté serveur/edge", () => {
    expect(existsSync("sentry.client.config.ts")).toBe(false)
    for (const f of ["sentry.server.config.ts", "sentry.edge.config.ts"]) {
      const src = readFileSync(f, "utf8")
      expect(src).toContain("environment: process.env.NODE_ENV")
      expect(src).toContain("sendDefaultPii: false")
      expect(src).toContain("scrubSentryEvent")
    }
  })
})
