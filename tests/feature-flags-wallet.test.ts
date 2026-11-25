import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  clearFeatureFlagCache,
  fetchFeatureFlag,
  resolveFlagRows,
  walletPathScope,
  FEATURE_FLAG_CACHE_TTL_MS,
} from "@/lib/feature-flags/core"

const OPTS = { supabaseUrl: "https://example.supabase.co", anonKey: "public-test-key" }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("resolveFlagRows", () => {
  it("n'active que sur is_active_public === true", () => {
    expect(resolveFlagRows([{ is_active_public: true }])).toBe(true)
    expect(resolveFlagRows([{ is_active_public: false }])).toBe(false)
    expect(resolveFlagRows([{ is_active_public: "true" }])).toBe(false)
    expect(resolveFlagRows([])).toBe(false)
    expect(resolveFlagRows(null)).toBe(false)
    expect(resolveFlagRows({ message: "relation does not exist" })).toBe(false)
  })
})

describe("fetchFeatureFlag (fail-closed)", () => {
  beforeEach(() => clearFeatureFlagCache())

  it("renvoie true quand la ligne est active", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ is_active_public: true }]))
    await expect(fetchFeatureFlag("wallet", { ...OPTS, fetchImpl })).resolves.toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain("/rest/v1/feature_flags?select=is_active_public&name=eq.wallet")
    expect((init.headers as Record<string, string>).apikey).toBe("public-test-key")
  })

  it("ligne absente (migration 082 non appliquée) → false", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([]))
    await expect(fetchFeatureFlag("wallet", { ...OPTS, fetchImpl })).resolves.toBe(false)
  })

  it("table absente (404 PostgREST) → false", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: "42P01" }, 404))
    await expect(fetchFeatureFlag("wallet", { ...OPTS, fetchImpl })).resolves.toBe(false)
  })

  it("erreur réseau → false", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down")
    })
    await expect(fetchFeatureFlag("wallet", { ...OPTS, fetchImpl })).resolves.toBe(false)
  })

  it("JSON invalide → false", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { status: 200 }))
    await expect(fetchFeatureFlag("wallet", { ...OPTS, fetchImpl })).resolves.toBe(false)
  })

  it("env Supabase absente → false sans appel réseau", async () => {
    const fetchImpl = vi.fn()
    await expect(
      fetchFeatureFlag("wallet", { supabaseUrl: "", anonKey: "", fetchImpl }),
    ).resolves.toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("met en cache 30 s puis relit", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ is_active_public: false }]))
      .mockResolvedValueOnce(jsonResponse([{ is_active_public: true }]))
    const now = 1_000_000
    expect(await fetchFeatureFlag("wallet", { ...OPTS, fetchImpl, now })).toBe(false)
    expect(await fetchFeatureFlag("wallet", { ...OPTS, fetchImpl, now: now + 1000 })).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(
      await fetchFeatureFlag("wallet", {
        ...OPTS,
        fetchImpl,
        now: now + FEATURE_FLAG_CACHE_TTL_MS + 1,
      }),
    ).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe("walletPathScope", () => {
  it.each([
    ["/wallet", "page"],
    ["/wallet/historique", "page"],
    ["/payout", "page"],
    ["/payout/x", "page"],
    ["/api/wallet/withdraw", "api"],
    ["/api/wallet", "api"],
    ["/api/payout/request", "api"],
  ])("%s → %s", (path, scope) => {
    expect(walletPathScope(path)).toBe(scope)
  })

  it.each([
    "/",
    "/wallets-info",
    "/payouts",
    "/admin/finances/payouts",
    "/api/admin/payouts",
    "/api/orders/1/confirm",
    "/api/payments/geniuspay/init",
    "/api/webhooks/geniuspay",
    "/dashboard",
  ])("%s hors wallet (escrow, ledger, paiements acheteur, ops admin intacts)", (path) => {
    expect(walletPathScope(path)).toBeNull()
  })
})
