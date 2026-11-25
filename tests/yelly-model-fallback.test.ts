import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/ops/platform-secrets", () => ({
  resolvePlatformSecret: async () => "test-key-fictive",
}))

import {
  askGeminiWithFallback,
  askYelly,
  resolveYellyModels,
  YELLY_DEFAULT_FALLBACK_MODEL,
  YELLY_DEFAULT_MODEL,
} from "@/lib/yelly/client"

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })

function mockFetch(responses: (() => Response | Promise<Response>)[]) {
  const urls: string[] = []
  const fn = vi.fn(async (url: string) => {
    urls.push(url)
    const next = responses.shift()
    if (!next) throw new Error("appel inattendu")
    return next()
  })
  vi.stubGlobal("fetch", fn)
  return urls
}

const base = { system: "s", history: [], userMsg: "u", apiKey: "k" }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("modèle Yelly", () => {
  it("par défaut : gemini-flash-lite-latest, second modèle distinct", () => {
    expect(YELLY_DEFAULT_MODEL).toBe("gemini-flash-lite-latest")
    expect(resolveYellyModels({})).toEqual({
      primary: "gemini-flash-lite-latest",
      fallback: YELLY_DEFAULT_FALLBACK_MODEL,
    })
  })
  it("YELLY_MODEL / YELLY_FALLBACK_MODEL priment ; nom OpenAI ignoré ; pas de doublon", () => {
    expect(resolveYellyModels({ YELLY_MODEL: "gemini-x", YELLY_FALLBACK_MODEL: "gemini-y" })).toEqual({
      primary: "gemini-x",
      fallback: "gemini-y",
    })
    expect(resolveYellyModels({ YELLY_MODEL: "gpt-4o-mini" }).primary).toBe(YELLY_DEFAULT_MODEL)
    expect(resolveYellyModels({ YELLY_MODEL: YELLY_DEFAULT_FALLBACK_MODEL }).fallback).toBeNull()
  })

  it("503 sur le premier modèle : réponse du second modèle", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const urls = mockFetch([() => new Response("busy", { status: 503 }), () => ok("Réponse du second modèle.")])
    const r = await askGeminiWithFallback({ ...base, models: { primary: "m1", fallback: "m2" } })
    expect(r).toMatchObject({ source: "llm", model: "m2" })
    expect(urls[0]).toContain("/models/m1:generateContent")
    expect(urls[1]).toContain("/models/m2:generateContent")
  })

  it("délai dépassé sur le premier modèle : essai du second", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFetch([
      () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })),
      () => ok("Réponse après délai dépassé."),
    ])
    const r = await askGeminiWithFallback({ ...base, models: { primary: "m1", fallback: "m2" } })
    expect(r?.model).toBe("m2")
  })

  it("400/403 (clé ou requête invalide) : pas de second essai", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const urls = mockFetch([() => new Response("bad", { status: 403 })])
    const r = await askGeminiWithFallback({ ...base, models: { primary: "m1", fallback: "m2" } })
    expect(r).toBeNull()
    expect(urls).toHaveLength(1)
  })

  it("premier modèle OK : un seul appel", async () => {
    const urls = mockFetch([() => ok("Réponse du premier modèle.")])
    const r = await askGeminiWithFallback({ ...base, models: { primary: "m1", fallback: "m2" } })
    expect(r?.model).toBe("m1")
    expect(urls).toHaveLength(1)
  })

  it("askYelly : 503 puis 503 → repli sans IA, la clé n'apparaît pas dans les logs", async () => {
    const errors: unknown[] = []
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a))
    mockFetch([() => new Response("busy", { status: 503 }), () => new Response("busy", { status: 503 })])
    const r = await askYelly({ message: "Comment sécher le cacao ?" })
    expect(r.source).toBe("fallback")
    expect(JSON.stringify(errors)).not.toContain("test-key-fictive")
  })
})
