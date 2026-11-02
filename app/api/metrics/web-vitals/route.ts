import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/security/rate-limiter"

export const dynamic = "force-dynamic"

const ALLOWED = new Set(["CLS", "INP", "LCP", "FCP", "TTFB"])

/**
 * Accepts anonymized Core Web Vitals beacons (no PII).
 * Fail-open if Redis rate-limit unavailable — metrics must never block UX.
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const limited = await rateLimit(`cwv:${ip}`, {
      maxRequests: 60,
      windowMs: 60_000,
    })
    if (limited.blocked) {
      return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 })
    }
  } catch {
    /* fail-open */
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const { name, value, path, rating } = body as Record<string, unknown>
  if (typeof name !== "string" || !ALLOWED.has(name)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 600_000) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const safePath =
    typeof path === "string" && path.startsWith("/") && path.length < 200
      ? path.replace(/[^\w\-/?=&%.]/g, "")
      : "/"

  // Structured log for Vercel / log drains — no cookies, no user ids
  console.info(
    JSON.stringify({
      type: "web_vital",
      name,
      value: Math.round(value),
      rating: typeof rating === "string" ? rating.slice(0, 32) : undefined,
      path: safePath,
      ts: new Date().toISOString(),
    }),
  )

  return NextResponse.json({ ok: true })
}
