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

  // Clé interne : valeur obligatoire + match secret env (pas juste présence)
  const internalHeader = (request.headers.get("x-gwa-internal-key") || "").trim()
  if (internalHeader) {
    const expected = (
      process.env.GWA_INTERNAL_KEY ||
      process.env.DIGEST_INTERNAL_KEY ||
      process.env.CRON_SECRET ||
      ""
    ).trim()
    if (expected && internalHeader === expected) return null
    return NextResponse.json(
      { error: "CSRF: clé interne invalide" },
      { status: 403 },
    )
  }

  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""

  if (!host) {
    return NextResponse.json({ error: "Origine invalide" }, { status: 403 })
  }

  const requestUrl = new URL(request.url)
  const forwardedProto = (request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "")).split(",")[0].trim()
  const forwardedHosts = [
    ...host.split(","),
    ...(request.headers.get("x-forwarded-host") || "").split(","),
    requestUrl.host,
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  // Trust only explicitly configured application origins plus the current request
  // host. This supports the canonical domain, www redirects, and Vercel previews
  // without accepting arbitrary origins from proxy headers.
  const allowedOrigins = new Set<string>(
    forwardedHosts.map((value) => `${forwardedProto}://${value}`),
  )
  for (const configuredUrl of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (!configuredUrl) continue
    try {
      const configured = new URL(configuredUrl)
      allowedOrigins.add(`${configured.protocol}//${configured.host}`.toLowerCase())
    } catch {
      // Ignore malformed optional configuration and keep the request-host fallback.
    }
  }

  const checkUrl = (raw: string | null): boolean => {
    if (!raw) return false
    try {
      const u = new URL(raw)
      return allowedOrigins.has(`${u.protocol}//${u.host}`.toLowerCase())
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
