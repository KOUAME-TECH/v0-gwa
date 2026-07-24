import { NextResponse } from "next/server"

/**
 * CSRF / cross-site mutation guard.
 * - Autorise same-origin (Origin ou Referer)
 * - Autorise Bearer / cron / webhooks (pas de cookie session navigateur)
 * - Refuse les mutations cross-site avec cookies
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const method = request.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null
  }

  // Auth non-cookie (Bearer, API keys) → hors scope CSRF navigateur
  const auth = request.headers.get("authorization") || ""
  if (/^Bearer\s+\S+/i.test(auth)) return null
  if (request.headers.get("x-vercel-cron") === "1") return null
  if (request.headers.get("x-gwa-internal-key")) return null

  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""

  if (!host) {
    return NextResponse.json({ error: "Origine invalide" }, { status: 403 })
  }

  const allowedHosts = new Set(
    host
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  )

  // Preview / prod Vercel aliases
  const requestUrl = new URL(request.url)
  allowedHosts.add(requestUrl.host.toLowerCase())

  const checkUrl = (raw: string | null): boolean => {
    if (!raw) return false
    try {
      const u = new URL(raw)
      return allowedHosts.has(u.host.toLowerCase())
    } catch {
      return false
    }
  }

  if (origin) {
    if (!checkUrl(origin)) {
      return NextResponse.json({ error: "CSRF: origine refusée" }, { status: 403 })
    }
    return null
  }

  // Certains navigateurs omettent Origin sur same-site POST → Referer OK
  if (referer) {
    if (!checkUrl(referer)) {
      return NextResponse.json({ error: "CSRF: referer refusé" }, { status: 403 })
    }
    return null
  }

  // Pas d'Origin ni Referer sur mutation cookie → refuse (sauf localhost dev)
  const isLocal =
    requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1"
  if (isLocal) return null

  return NextResponse.json(
    { error: "CSRF: en-têtes Origin/Referer manquants" },
    { status: 403 },
  )
}
