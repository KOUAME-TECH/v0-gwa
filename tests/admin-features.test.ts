import { describe, it, expect, vi, beforeEach } from "vitest"
import { featureFlagPatchSchema, isMissingColumnError } from "@/lib/feature-flags/admin"
import {
  canAccessSection,
  canToggleFeatureFlag,
  filterNavForRole,
} from "@/lib/auth/admin-permissions"

describe("featureFlagPatchSchema (Zod)", () => {
  it("accepte une bascule valide", () => {
    expect(featureFlagPatchSchema.safeParse({ name: "wallet", is_active_public: false }).success).toBe(true)
  })
  it.each([
    [{ name: "inconnu", is_active_public: true }],
    [{ name: "wallet" }],
    [{ name: "wallet", is_active_public: "true" }],
    [{ name: "wallet", is_active_public: true, extra: 1 }],
    [null],
  ])("refuse %j", (body) => {
    expect(featureFlagPatchSchema.safeParse(body).success).toBe(false)
  })
})

describe("permissions back-office features", () => {
  it("section réservée à super_admin et admin", () => {
    expect(canAccessSection("super_admin", "features")).toBe(true)
    expect(canAccessSection("admin", "features")).toBe(true)
    for (const r of ["finance_admin", "moderator", "support"] as const) {
      expect(canAccessSection(r, "features")).toBe(false)
      expect(filterNavForRole(r).some((n) => n.href === "/admin/features")).toBe(false)
    }
  })
  it("wallet : super_admin uniquement", () => {
    expect(canToggleFeatureFlag("super_admin", "wallet")).toBe(true)
    expect(canToggleFeatureFlag("admin", "wallet")).toBe(false)
    expect(canToggleFeatureFlag("admin", "video_calls")).toBe(true)
    expect(canToggleFeatureFlag("support", "video_calls")).toBe(false)
  })
  it("détecte les colonnes 082 absentes", () => {
    expect(isMissingColumnError({ code: "PGRST204" })).toBe(true)
    expect(isMissingColumnError({ code: "42703" })).toBe(true)
    expect(isMissingColumnError({ code: "23505" })).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
  })
})

// ---- Route PATCH /api/admin/features --------------------------------------

type Op = { table: string; kind: string; payload?: unknown }
const ops: Op[] = []
const state = {
  role: "super_admin" as string,
  isAdmin: true,
  user: { id: "admin-1" } as { id: string } | null,
  rateOk: true,
  row: { name: "wallet", is_active_public: false, is_active_beta: false, description: null } as Record<string, unknown> | null,
  auditError: null as null | { message: string },
  missingColumns: false,
}

function builder(table: string) {
  let kind = "select"
  let payload: unknown
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.eq = chain
  b.order = async () => ({ data: state.row ? [state.row] : [], error: null })
  b.update = (p: unknown) => {
    kind = "update"
    payload = p
    return b
  }
  b.insert = async (p: unknown) => {
    ops.push({ table, kind: "insert", payload: p })
    if (table === "audit_logs") return { error: state.auditError }
    return { error: null }
  }
  b.maybeSingle = async () => {
    if (kind === "update") {
      ops.push({ table, kind: "update", payload })
      if (state.missingColumns && payload && typeof payload === "object" && "updated_by" in payload) {
        return { data: null, error: { code: "PGRST204", message: "column not found" } }
      }
      return { data: { ...state.row, ...(payload as object) }, error: null }
    }
    return { data: state.row, error: null }
  }
  b.then = (resolve: (v: unknown) => unknown) => {
    if (kind === "update") ops.push({ table, kind: "update", payload })
    return Promise.resolve({ error: null }).then(resolve)
  }
  return b
}

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdminSection: async () =>
    state.isAdmin
      ? { isAdmin: true, user: state.user, admin: { from: builder }, role: { role: state.role }, error: null }
      : { isAdmin: false, user: state.user, error: "Accès section refusé" },
}))
vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit: async () => ({ success: state.rateOk, remaining: 0, resetAt: 0, blocked: false }),
}))

function patch(body: unknown) {
  return new Request("https://gwa.test/api/admin/features", {
    method: "PATCH",
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: JSON.stringify(body),
  }) as never
}

describe("PATCH /api/admin/features", () => {
  beforeEach(() => {
    ops.length = 0
    Object.assign(state, {
      role: "super_admin",
      isAdmin: true,
      user: { id: "admin-1" },
      rateOk: true,
      row: { name: "wallet", is_active_public: false, is_active_beta: false, description: null },
      auditError: null,
      missingColumns: false,
    })
  })

  it("401 sans session, 403 sans section", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    state.isAdmin = false
    state.user = null
    expect((await PATCH(patch({ name: "wallet", is_active_public: true }))).status).toBe(401)
    state.user = { id: "u" }
    expect((await PATCH(patch({ name: "wallet", is_active_public: true }))).status).toBe(403)
    expect(ops).toHaveLength(0)
  })

  it("429 quand le rate limit est atteint", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    state.rateOk = false
    expect((await PATCH(patch({ name: "video_calls", is_active_public: true }))).status).toBe(429)
    expect(ops).toHaveLength(0)
  })

  it("400 sur corps invalide", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    expect((await PATCH(patch({ name: "wallet", is_active_public: "oui" }))).status).toBe(400)
  })

  it("403 : un admin simple ne peut pas basculer wallet", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    state.role = "admin"
    expect((await PATCH(patch({ name: "wallet", is_active_public: true }))).status).toBe(403)
    expect(ops.filter((o) => o.kind === "update")).toHaveLength(0)
  })

  it("succès : update + audit_logs critique + admin_logs", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    const res = await PATCH(patch({ name: "wallet", is_active_public: true, reason: "test QA" }))
    expect(res.status).toBe(200)
    const audit = ops.find((o) => o.table === "audit_logs")?.payload as Record<string, unknown>
    expect(audit).toMatchObject({ action: "feature_flag_update", target_type: "feature_flag", severity: "critical" })
    expect(audit.metadata).toMatchObject({
      flag: "wallet",
      before: { is_active_public: false },
      after: { is_active_public: true },
    })
    expect(ops.some((o) => o.table === "admin_logs")).toBe(true)
  })

  it("audit en échec → bascule annulée et 500", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    state.auditError = { message: "boom" }
    const res = await PATCH(patch({ name: "video_calls", is_active_public: true }))
    expect(res.status).toBe(500)
    const updates = ops.filter((o) => o.kind === "update")
    expect(updates.at(-1)?.payload).toEqual({ is_active_public: false, is_active_beta: false })
  })

  it("082 non appliquée : réessaie sans updated_at/updated_by", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    state.missingColumns = true
    const res = await PATCH(patch({ name: "video_calls", is_active_beta: true }))
    expect(res.status).toBe(200)
    const updates = ops.filter((o) => o.kind === "update")
    expect(updates[1]?.payload).toEqual({ is_active_beta: true })
  })

  it("404 si la ligne n'existe pas", async () => {
    const { PATCH } = await import("@/app/api/admin/features/route")
    state.row = null
    expect((await PATCH(patch({ name: "wallet", is_active_public: false }))).status).toBe(404)
  })
})
