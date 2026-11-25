import { afterEach, describe, expect, it, vi } from "vitest"

const loaded: string[] = []
vi.mock("@sentry/nextjs", () => ({ captureRequestError: vi.fn(), init: vi.fn() }))
vi.mock("../sentry.server.config", () => {
  loaded.push("server")
  return {}
})
vi.mock("../sentry.edge.config", () => {
  loaded.push("edge")
  return {}
})

describe("instrumentation.ts (Next 16)", () => {
  const prev = process.env.NEXT_RUNTIME
  afterEach(() => {
    process.env.NEXT_RUNTIME = prev
  })
  it("charge la config Sentry serveur en runtime Node et edge en runtime Edge", async () => {
    const mod = await import("../instrumentation")
    process.env.NEXT_RUNTIME = "nodejs"
    await mod.register()
    process.env.NEXT_RUNTIME = "edge"
    await mod.register()
    expect(loaded).toEqual(["server", "edge"])
    expect(typeof mod.onRequestError).toBe("function")
  })
})
