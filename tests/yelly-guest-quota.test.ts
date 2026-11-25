import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

// Données fictives. Pas d'Upstash en test : repli mémoire du rate-limiter.
const headerStore = new Map<string, string>()
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerStore.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ getAll: () => [] }),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}))
vi.mock("@/lib/yelly/client", () => ({
  askYelly: async () => ({ reply: "Réponse de test suffisamment longue.", source: "llm", model: "test" }),
}))

import { consumeYellyGuestQuota, yellyGuestQuotaKey } from "@/lib/yelly/guest-quota"

let ipSeq = 0
const freshIp = () => `203.0.113.${++ipSeq}`

describe("consumeYellyGuestQuota", () => {
  it("décompte 2, 1, 0 puis refuse, même sans cookie (compteur serveur par IP)", async () => {
    const ip = freshIp()
    const seen = []
    for (let i = 0; i < 3; i += 1) seen.push(await consumeYellyGuestQuota({ ip, cookieUsed: 0 }))
    expect(seen.map((q) => q.remaining)).toEqual([2, 1, 0])
    expect(seen.every((q) => q.allowed)).toBe(true)
    const fourth = await consumeYellyGuestQuota({ ip, cookieUsed: 0 })
    expect(fourth).toEqual({ allowed: false, used: 3, remaining: 0 })
  })

  it("retient le plus élevé du cookie et du compteur serveur", async () => {
    const q = await consumeYellyGuestQuota({ ip: freshIp(), cookieUsed: 2 })
    expect(q).toEqual({ allowed: true, used: 3, remaining: 0 })
  })

  it("cookie déjà au plafond : refus sans consommer le compteur", async () => {
    const limiter = vi.fn()
    const q = await consumeYellyGuestQuota({ ip: freshIp(), cookieUsed: 3, limiter })
    expect(q.allowed).toBe(false)
    expect(limiter).not.toHaveBeenCalled()
  })

  it("clé Upstash : fenêtre 24 h, IP hachée (jamais en clair)", async () => {
    const limiter = vi.fn(async () => ({ success: true, remaining: 2, resetAt: 0, blocked: false }))
    await consumeYellyGuestQuota({ ip: "198.51.100.7", cookieUsed: 0, limiter })
    const [key, cfg] = limiter.mock.calls[0] as unknown as [string, { maxRequests: number; windowMs: number }]
    expect(key).toBe(yellyGuestQuotaKey("198.51.100.7"))
    expect(key).toMatch(/^YELLY_GUEST_DAY:[0-9a-f]{32}$/)
    expect(key).not.toContain("198.51.100.7")
    expect(cfg).toEqual({ maxRequests: 3, windowMs: 24 * 60 * 60 * 1000 })
  })

  it("Upstash refuse (plafond atteint ou indisponible en prod) : refus", async () => {
    const limiter = vi.fn(async () => ({ success: false, remaining: 0, resetAt: 0, blocked: false }))
    const q = await consumeYellyGuestQuota({ ip: freshIp(), cookieUsed: 0, limiter })
    expect(q.allowed).toBe(false)
  })
})

describe("POST /api/yelly/chat — invité", () => {
  beforeEach(() => {
    headerStore.clear()
    headerStore.set("x-forwarded-for", freshIp())
  })

  function call(cookie?: string) {
    const h: Record<string, string> = {
      "content-type": "application/json",
      origin: "https://mygwa.org",
      referer: "https://mygwa.org/",
      host: "mygwa.org",
    }
    if (cookie) h.cookie = cookie
    return new NextRequest("https://mygwa.org/api/yelly/chat", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ message: "Comment bien sécher le cacao après la récolte ?", page: "/" }),
    })
  }

  it("guestRemaining décompte sur des appels successifs sans cookie (2, 1, 0, puis 401)", async () => {
    const { POST } = await import("@/app/api/yelly/chat/route")
    const remaining = []
    for (let i = 0; i < 3; i += 1) {
      const res = await POST(call())
      expect(res.status).toBe(200)
      remaining.push((await res.json()).guestRemaining)
    }
    expect(remaining).toEqual([2, 1, 0])
    const blocked = await POST(call())
    expect(blocked.status).toBe(401)
    expect((await blocked.json()).guestRemaining).toBe(0)
  })

  it("le cookie posé suit le compteur serveur", async () => {
    const { POST } = await import("@/app/api/yelly/chat/route")
    const first = await POST(call())
    expect(first.cookies.get("yelly_guest_n")?.value).toBe("1")
    const second = await POST(call("yelly_guest_n=1"))
    expect(second.cookies.get("yelly_guest_n")?.value).toBe("2")
    expect((await second.json()).guestRemaining).toBe(1)
  })
})
