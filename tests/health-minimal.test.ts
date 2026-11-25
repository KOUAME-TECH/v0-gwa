import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  createClient,
  requireAdmin,
  getSmsOpsFailure,
  isOtpStoreReady,
  hasSmsProvider,
  hasAfricasTalkingProvider,
  hasAfricasTalkingSenderId,
  isAfricasTalkingLiveUsername,
  resolveAfricasTalkingSenderId,
  hasPlatformSecret,
  getOneSignalAppId,
  getOneSignalRestApiKey,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAdmin: vi.fn(),
  getSmsOpsFailure: vi.fn(),
  isOtpStoreReady: vi.fn(),
  hasSmsProvider: vi.fn(),
  hasAfricasTalkingProvider: vi.fn(),
  hasAfricasTalkingSenderId: vi.fn(),
  isAfricasTalkingLiveUsername: vi.fn(),
  resolveAfricasTalkingSenderId: vi.fn(),
  hasPlatformSecret: vi.fn(),
  getOneSignalAppId: vi.fn(),
  getOneSignalRestApiKey: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({ createClient }))
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin }))
vi.mock("@/lib/auth/otp-store", () => ({ getSmsOpsFailure, isOtpStoreReady }))
vi.mock("@/lib/auth/sms", () => ({
  hasSmsProvider,
  hasAfricasTalkingProvider,
  hasAfricasTalkingSenderId,
  isAfricasTalkingLiveUsername,
  resolveAfricasTalkingSenderId,
}))
vi.mock("@/lib/ops/platform-secrets", () => ({ hasPlatformSecret }))
vi.mock("@/lib/notifications/onesignal-config", () => ({
  getOneSignalAppId,
  getOneSignalRestApiKey,
}))

import { GET } from "@/app/api/health/route"
import { PUBLIC_HEALTH_KEYS } from "@/lib/ops/health"

const CRON = "cron-secret-test"
const PUBLIC_KEYS = [...PUBLIC_HEALTH_KEYS].sort()

function setNodeEnv(value: string | undefined) {
  const env = process.env as { NODE_ENV?: string }
  if (value === undefined) delete env.NODE_ENV
  else env.NODE_ENV = value
}

async function bodyOf(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

describe("/api/health — surface publique minimale", () => {
  const prevCron = process.env.CRON_SECRET
  const prevNode = process.env.NODE_ENV

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON
    setNodeEnv("production")
    createClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          limit: async () => ({ data: [{ id: "1" }], error: null }),
        }),
      }),
    })
    requireAdmin.mockResolvedValue({ user: null, isAdmin: false })
    getSmsOpsFailure.mockResolvedValue({
      at: "2026-11-05T12:07:00.000Z",
      code: "AT_SENDER",
    })
    isOtpStoreReady.mockReturnValue(true)
    hasSmsProvider.mockReturnValue(true)
    hasAfricasTalkingProvider.mockReturnValue(true)
    hasAfricasTalkingSenderId.mockReturnValue(true)
    isAfricasTalkingLiveUsername.mockReturnValue(true)
    resolveAfricasTalkingSenderId.mockResolvedValue("GWA")
    hasPlatformSecret.mockResolvedValue(false)
    getOneSignalAppId.mockReturnValue("app")
    getOneSignalRestApiKey.mockReturnValue("key")
  })

  afterEach(() => {
    if (prevCron === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prevCron
    setNodeEnv(prevNode)
  })

  it("sans auth, ne renvoie que status / version / db", async () => {
    const res = await GET(new Request("https://gwa.test/api/health"))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("no-store")
    const body = await bodyOf(res)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(body.status).toBe("healthy")
    expect(body.version).toBe("2.0.0")
    expect(body.db).toBe("connected")
    expect(body).not.toHaveProperty("secrets")
    expect(body).not.toHaveProperty("sms_last_failure")
    expect(body).not.toHaveProperty("geniuspay")
    expect(body).not.toHaveProperty("sms_delivery_ready")
    expect(body).not.toHaveProperty("deploy")
    expect(getSmsOpsFailure).not.toHaveBeenCalled()
    expect(hasPlatformSecret).not.toHaveBeenCalled()
  })

  it("reste public (pas 401) si la DB est en erreur, toujours sans détails", async () => {
    createClient.mockRejectedValue(new Error("db down"))
    const res = await GET(new Request("https://gwa.test/api/health"))
    expect(res.status).toBe(503)
    const body = await bodyOf(res)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(body.status).toBe("degraded")
    expect(body.db).toBe("error")
    expect(body).not.toHaveProperty("secrets")
    expect(getSmsOpsFailure).not.toHaveBeenCalled()
  })

  it("avec Bearer CRON_SECRET, expose secrets + dernier échec SMS", async () => {
    const res = await GET(
      new Request("https://gwa.test/api/health", {
        headers: { authorization: `Bearer ${CRON}` },
      }),
    )
    expect(res.status).toBe(200)
    const body = await bodyOf(res)
    expect(body.status).toBe("healthy")
    expect(body.db).toBe("connected")
    expect(body.secrets).toBeDefined()
    expect((body.secrets as Record<string, unknown>).CRON_SECRET).toBe(true)
    expect(body.sms_last_failure).toEqual({
      at: "2026-11-05T12:07:00.000Z",
      code: "AT_SENDER",
    })
    expect(body.geniuspay).toBeDefined()
    expect(body.sms_delivery_ready).toBe(true)
    expect(requireAdmin).not.toHaveBeenCalled()
  })

  it("accepte un CRON_SECRET entouré de guillemets, comme authorizeCronRequest", async () => {
    process.env.CRON_SECRET = `"${CRON}"`
    const res = await GET(
      new Request("https://gwa.test/api/health", {
        headers: { authorization: `Bearer ${CRON}` },
      }),
    )
    const body = await bodyOf(res)
    expect(res.status).toBe(200)
    expect(body.secrets).toBeDefined()
  })

  it("refuse les détails pour un Bearer incorrect", async () => {
    const res = await GET(
      new Request("https://gwa.test/api/health", {
        headers: { authorization: "Bearer not-the-secret" },
      }),
    )
    const body = await bodyOf(res)
    expect(res.status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(body).not.toHaveProperty("secrets")
    expect(getSmsOpsFailure).not.toHaveBeenCalled()
  })

  it("refuse les détails pour le seul header x-vercel-cron", async () => {
    const res = await GET(
      new Request("https://gwa.test/api/health", {
        headers: { "x-vercel-cron": "1" },
      }),
    )
    const body = await bodyOf(res)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(body).not.toHaveProperty("secrets")
    expect(getSmsOpsFailure).not.toHaveBeenCalled()
  })

  it("refuse les détails en dev sans secret", async () => {
    delete process.env.CRON_SECRET
    setNodeEnv("development")
    const res = await GET(new Request("https://gwa.test/api/health"))
    const body = await bodyOf(res)
    expect(res.status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(getSmsOpsFailure).not.toHaveBeenCalled()
  })

  it("expose les détails pour une session admin active", async () => {
    requireAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      isAdmin: true,
      role: { role: "admin" },
    })
    const res = await GET(new Request("https://gwa.test/api/health"))
    const body = await bodyOf(res)
    expect(res.status).toBe(200)
    expect(body.secrets).toBeDefined()
    expect(body.sms_last_failure).toBeDefined()
    expect(body.deploy).toBeDefined()
  })

  it("reste minimal pour un utilisateur authentifié non admin", async () => {
    requireAdmin.mockResolvedValue({
      user: { id: "user-1" },
      isAdmin: false,
    })
    const res = await GET(new Request("https://gwa.test/api/health"))
    const body = await bodyOf(res)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(body).not.toHaveProperty("sms_last_failure")
  })

  it("reste 200 public si requireAdmin lève (sonde d'uptime)", async () => {
    requireAdmin.mockRejectedValue(new Error("session store down"))
    const res = await GET(new Request("https://gwa.test/api/health"))
    expect(res.status).toBe(200)
    const body = await bodyOf(res)
    expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS)
    expect(getSmsOpsFailure).not.toHaveBeenCalled()
  })

  it("avec Bearer, garde 503 et les détails si la DB est en erreur", async () => {
    createClient.mockRejectedValue(new Error("db down"))
    const res = await GET(
      new Request("https://gwa.test/api/health", {
        headers: { authorization: `Bearer ${CRON}` },
      }),
    )
    expect(res.status).toBe(503)
    const body = await bodyOf(res)
    expect(body.status).toBe("degraded")
    expect(body.db).toBe("error")
    expect(body.secrets).toBeDefined()
    expect(body.sms_last_failure).toBeDefined()
  })
})
