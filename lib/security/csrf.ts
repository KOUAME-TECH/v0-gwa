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

  // Cron Vercel : le header seul ne bypass PAS le CSRF ici —
  // les routes /api/cron sont exemptées dans middleware + exigent CRON_SECRET.
  if (request.headers.get("x-vercel-cron") === "1") {
    const cronSecret = (process.env.CRON_SECRET || "").replace(/^"|"$/g, "").trim()
    const auth = request.headers.get("authorization") || ""
    if (cronSecret && auth === `Bearer ${cronSecret}`) return null
    // Sans Bearer valide : ne pas court-circuiter Origin (défense en profondeur)
  }

  // Pas de bypass Bearer JWT-shaped : un token forgeable (3 segments) ne doit
  // jamais court-circuiter Origin/Referer. Les routes cron/webhook sont
  // exemptées dans middleware + secrets dédiés.

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
