/**
 * Lot C — CSRF au niveau route (extrait de #26).
 * Les 15 routes ci-dessous appellent assertSameOrigin en tête de chaque
 * handler mutant. On vérifie :
 *   1. statiquement : chaque POST/PUT/PATCH/DELETE exporté commence par la garde ;
 *   2. dynamiquement : une requête cross-origin (ou sans Origin/Referer) reçoit
 *      403 AVANT toute création de client Supabase, admin ou rate limit ;
 *   3. une requête same-origin franchit la garde (pas de 403 CSRF).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const deps = vi.hoisted(() => {
  const sentinel = () => {
    throw new Error("__past_csrf__")
  }
  return {
    createClient: vi.fn(sentinel),
    createAdminClient: vi.fn(sentinel),
    requireAdmin: vi.fn(sentinel),
    checkRateLimit: vi.fn(sentinel),
  }
})

vi.mock("@/lib/supabase/server", () => ({ createClient: deps.createClient }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: deps.createAdminClient }))
vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: deps.requireAdmin,
  requireAdminSection: deps.requireAdmin,
}))
vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit: deps.checkRateLimit,
  RATE_LIMITS: {},
}))

export const LOT_C_CSRF_ROUTES = [
  "auth/link-email",
  "auth/logout",
  "comments/like",
  "factoring",
  "location/save",
  "messages/notify",
  "notifications",
  "onesignal/register",
  "places",
  "places/[id]",
  "posts/[id]",
  "products/[id]/favorite",
  "products/[id]/photos",
  "push/status",
  "scg/calculate",
] as const

const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const
const root = path.resolve(__dirname, "..")
const routeFile = (r: string) => path.join(root, "app/api", r, "route.ts")

function mutatingHandlers(src: string): { method: string; body: string }[] {
  const re = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(/g
  const found: { method: string; index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) found.push({ method: m[1], index: m.index })
  return found.map((f, i) => ({
    method: f.method,
    body: src.slice(f.index, found[i + 1]?.index ?? src.length),
  }))
}

const ORIGIN = "https://gwa.test"
const ctx = { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) }

function req(method: string, r: string, headers: Record<string, string>) {
  return new Request(`${ORIGIN}/api/${r.replace(/\[id\]/g, "00000000-0000-0000-0000-000000000000")}`, {
    method,
    headers: { host: "gwa.test", "content-type": "application/json", ...headers },
    body: "{}",
  })
}

async function call(mod: Record<string, unknown>, method: string, request: Request) {
  const handler = mod[method] as (req: Request, ctx: unknown) => Promise<Response>
  try {
    return await handler(request, ctx)
  } catch (e) {
    if (e instanceof Error && e.message === "__past_csrf__") return "past" as const
    throw e
  }
}

describe("Lot C — assertSameOrigin sur les 15 routes", () => {
  const prev = { app: process.env.NEXT_PUBLIC_APP_URL, site: process.env.NEXT_PUBLIC_SITE_URL }
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    for (const fn of Object.values(deps)) fn.mockClear()
  })
  afterEach(() => {
    if (prev.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = prev.app
    if (prev.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prev.site
  })

  it("liste complète : 15 routes", () => {
    expect(LOT_C_CSRF_ROUTES).toHaveLength(15)
  })

  for (const r of LOT_C_CSRF_ROUTES) {
    describe(`/api/${r}`, () => {
      const src = readFileSync(routeFile(r), "utf8")
      const handlers = mutatingHandlers(src)

      it("chaque handler mutant commence par assertSameOrigin", () => {
        expect(handlers.length).toBeGreaterThan(0)
        for (const h of handlers) {
          // Corps de la fonction : après la fin de signature « ) {» (multi-ligne possible)
          const open = /\)\s*(?::[^\n{]*)?\{\s*\n/.exec(h.body)
          expect(open, `${h.method} /api/${r} : signature introuvable`).not.toBeNull()
          const firstStatements = h.body.slice(open!.index + open![0].length).trimStart()
          expect(firstStatements, `${h.method} /api/${r}`).toMatch(
            /^const\s+csrf\s*=\s*assertSameOrigin\(\s*request\s*\)\s*\n\s*if\s*\(\s*csrf\s*\)\s*return\s+csrf/,
          )
        }
      })

      for (const h of handlers) {
        it(`${h.method} cross-origin → 403 avant tout accès base`, async () => {
          const mod = await import(`@/app/api/${r}/route`)
          const res = await call(mod, h.method, req(h.method, r, { origin: "https://evil.example" }))
          expect(res).not.toBe("past")
          expect((res as Response).status).toBe(403)
          for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled()
        })

        it(`${h.method} sans Origin ni Referer → 403`, async () => {
          const mod = await import(`@/app/api/${r}/route`)
          const res = await call(mod, h.method, req(h.method, r, {}))
          expect(res).not.toBe("past")
          expect((res as Response).status).toBe(403)
        })

        it(`${h.method} Referer étranger → 403`, async () => {
          const mod = await import(`@/app/api/${r}/route`)
          const res = await call(mod, h.method, req(h.method, r, { referer: "https://evil.example/x" }))
          expect(res).not.toBe("past")
          expect((res as Response).status).toBe(403)
        })

        it(`${h.method} same-origin → franchit la garde`, async () => {
          const mod = await import(`@/app/api/${r}/route`)
          const res = await call(mod, h.method, req(h.method, r, { origin: ORIGIN }))
          if (res !== "past") {
            const body = await res.clone().json().catch(() => ({}))
            expect(String((body as { error?: string }).error || "")).not.toMatch(/CSRF|Origine invalide/)
          }
        })
      }
    })
  }
})
