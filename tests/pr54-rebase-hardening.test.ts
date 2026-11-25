import { createHmac } from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { hasUpstash, createAdminClient, resolveGeniusPayWebhookSecret, recordLedgerLines } = vi.hoisted(() => ({
  hasUpstash: vi.fn(),
  createAdminClient: vi.fn(),
  resolveGeniusPayWebhookSecret: vi.fn(),
  recordLedgerLines: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/security/upstash", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  hasUpstash,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/payment/geniuspay", () => ({ resolveGeniusPayWebhookSecret }))
vi.mock("@/lib/features/payments/ledger", () => ({
  payInLedgerLines: () => [],
  recordLedgerLines,
}))

import { safeOAuthNextPath } from "@/lib/auth/oauth"
import { rateLimit } from "@/lib/security/rate-limiter"
import { POST as geniuspayWebhook } from "@/app/api/webhooks/geniuspay/route"

function setNodeEnv(value: string | undefined) {
  const env = process.env as { NODE_ENV?: string }
  if (value === undefined) delete env.NODE_ENV
  else env.NODE_ENV = value
}

describe("safeOAuthNextPath — redirect borné (#54)", () => {
  it("rejette backslash, schéma et // encodé", () => {
    expect(safeOAuthNextPath("/\\evil.example")).toBeNull()
    expect(safeOAuthNextPath("/%5Cevil.example")).toBeNull()
    expect(safeOAuthNextPath("/%2F%2Fevil.example")).toBeNull()
    expect(safeOAuthNextPath("/redirect?u=https://evil.example")).toBeNull()
    expect(safeOAuthNextPath("  //evil.example")).toBeNull()
  })
  it("garde un chemin interne", () => {
    expect(safeOAuthNextPath(" /commandes/123 ")).toBe("/commandes/123")
  })
})

describe("rateLimit — fail-closed en production sans Redis (#54)", () => {
  const prev = process.env.NODE_ENV
  afterEach(() => setNodeEnv(prev))

  it("bloque en production si Upstash est absent", async () => {
    hasUpstash.mockReturnValue(false)
    setNodeEnv("production")
    const res = await rateLimit("t:prod", { maxRequests: 5, windowMs: 60_000 })
    expect(res.success).toBe(false)
    expect(res.blocked).toBe(true)
  })

  it("garde le repli mémoire hors production", async () => {
    hasUpstash.mockReturnValue(false)
    setNodeEnv("test")
    const res = await rateLimit("t:dev", { maxRequests: 5, windowMs: 60_000 })
    expect(res.success).toBe(true)
  })
})

describe("webhook GeniusPay — montant et devise obligatoires sur un succès (#54)", () => {
  const SECRET = "whsec-test"
  let updates: unknown[]

  function signed(payload: Record<string, unknown>) {
    const raw = JSON.stringify(payload)
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex")
    return new Request("https://gwa.test/api/webhooks/geniuspay", {
      method: "POST",
      body: raw,
      headers: { "x-webhook-signature": sig, "x-webhook-timestamp": ts },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    updates = []
    resolveGeniusPayWebhookSecret.mockResolvedValue(SECRET)
    const order = {
      id: "o1",
      total_amount: 5000,
      payment_status: "processing",
      escrow_status: "pending",
      fulfillment_mode: "delivery",
      currency: "XOF",
    }
    createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order, error: null }) }) }),
        update: (patch: unknown) => {
          updates.push(patch)
          throw new Error("update inattendu")
        },
      }),
    })
  })

  it("refuse un succès sans devise", async () => {
    const res = await geniuspayWebhook(signed({ reference: "R1", status: "success", amount: 5000 }))
    expect(res.status).toBe(422)
    expect(updates).toHaveLength(0)
  })

  it("refuse un succès sans montant", async () => {
    const res = await geniuspayWebhook(signed({ reference: "R1", status: "success", currency: "XOF" }))
    expect(res.status).toBe(422)
    expect(updates).toHaveLength(0)
  })

  it("refuse un succès dans une autre devise", async () => {
    const res = await geniuspayWebhook(
      signed({ reference: "R1", status: "success", amount: 5000, currency: "EUR" }),
    )
    expect(res.status).toBe(422)
    expect(updates).toHaveLength(0)
  })
})
