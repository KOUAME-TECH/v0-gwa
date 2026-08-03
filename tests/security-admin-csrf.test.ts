import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { assertSameOrigin } from "@/lib/security/csrf"
import { isAdminRole } from "@/lib/auth/admin-permissions"

describe("CSRF x-gwa-internal-key", () => {
  const prevKey = process.env.GWA_INTERNAL_KEY
  const prevDigest = process.env.DIGEST_INTERNAL_KEY
  const prevCron = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.GWA_INTERNAL_KEY = "secret-test-key"
    delete process.env.DIGEST_INTERNAL_KEY
    delete process.env.CRON_SECRET
  })

  afterEach(() => {
    if (prevKey === undefined) delete process.env.GWA_INTERNAL_KEY
    else process.env.GWA_INTERNAL_KEY = prevKey
    if (prevDigest === undefined) delete process.env.DIGEST_INTERNAL_KEY
    else process.env.DIGEST_INTERNAL_KEY = prevDigest
    if (prevCron === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prevCron
  })

  it("refuse une clé présente mais fausse", () => {
    const req = new Request("https://gwa.test/api/x", {
      method: "POST",
      headers: {
        "x-gwa-internal-key": "wrong",
        host: "gwa.test",
      },
    })
    const res = assertSameOrigin(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it("accepte la clé correcte", () => {
    const req = new Request("https://gwa.test/api/x", {
      method: "POST",
      headers: {
        "x-gwa-internal-key": "secret-test-key",
        host: "gwa.test",
      },
    })
    expect(assertSameOrigin(req)).toBeNull()
  })
})

describe("isAdminRole — pas d’escalade silencieuse", () => {
  it("refuse les rôles inconnus", () => {
    expect(isAdminRole("admin")).toBe(true)
    expect(isAdminRole("moderator")).toBe(true)
    expect(isAdminRole("god")).toBe(false)
    expect(isAdminRole("")).toBe(false)
    expect(isAdminRole(null)).toBe(false)
  })
})
