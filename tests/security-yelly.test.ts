import { describe, expect, it } from "vitest"
import { assertSameOrigin } from "@/lib/security/csrf"
import {
  sanitizeForQuery,
  sanitizeHtml,
  sanitizePlainText,
  yellyChatSchema,
} from "@/lib/security/validation"

describe("sanitizeForQuery (PostgREST)", () => {
  it("strips filter injection chars", () => {
    const dirty = `a'),status.eq.hacked--`
    const clean = sanitizeForQuery(dirty)
    expect(clean).not.toMatch(/['(),]/)
    expect(clean).not.toContain("--")
  })

  it("limits length", () => {
    expect(sanitizeForQuery("x".repeat(500)).length).toBeLessThanOrEqual(120)
  })
})

describe("sanitizeHtml / XSS", () => {
  it("strips tags and handlers", () => {
    expect(sanitizeHtml(`<img src=x onerror=alert(1)>`)).not.toMatch(/<|>|onerror/i)
    expect(sanitizeHtml(`<script>alert(1)</script>hi`)).toBe("hi")
    expect(sanitizePlainText("Hello <b>world</b>", 20)).toBe("Hello world")
  })
})

describe("assertSameOrigin CSRF", () => {
  it("allows same-origin POST", () => {
    const req = new Request("https://v0-gwa-mu.vercel.app/api/comments", {
      method: "POST",
      headers: { Origin: "https://v0-gwa-mu.vercel.app", Host: "v0-gwa-mu.vercel.app" },
    })
    expect(assertSameOrigin(req)).toBeNull()
  })

  it("rejects cross-origin POST", () => {
    const req = new Request("https://v0-gwa-mu.vercel.app/api/comments", {
      method: "POST",
      headers: { Origin: "https://evil.example", Host: "v0-gwa-mu.vercel.app" },
    })
    const res = assertSameOrigin(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(403)
  })

  it("allows GET without origin", () => {
    const req = new Request("https://v0-gwa-mu.vercel.app/api/comments", {
      method: "GET",
      headers: { Host: "v0-gwa-mu.vercel.app" },
    })
    expect(assertSameOrigin(req)).toBeNull()
  })

  it("refuse Bearer court forgeable without origin", () => {
    const req = new Request("https://v0-gwa-mu.vercel.app/api/cron/x", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        Host: "v0-gwa-mu.vercel.app",
      },
    })
    const res = assertSameOrigin(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(403)
  })

  it("allows JWT-shaped Bearer without origin", () => {
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${"a".repeat(40)}.${"b".repeat(40)}`
    const req = new Request("https://v0-gwa-mu.vercel.app/api/x", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Host: "v0-gwa-mu.vercel.app",
      },
    })
    expect(assertSameOrigin(req)).toBeNull()
  })
})

describe("yellyChatSchema", () => {
  it("accepts clean message", () => {
    const r = yellyChatSchema.safeParse({ message: "Comment publier ?" })
    expect(r.success).toBe(true)
  })

  it("strips html in message", () => {
    const r = yellyChatSchema.safeParse({
      message: "Aide <script>x</script> SVP",
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.message).not.toMatch(/script/i)
  })

  it("rejects empty", () => {
    expect(yellyChatSchema.safeParse({ message: "" }).success).toBe(false)
  })
})
