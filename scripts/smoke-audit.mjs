/**
 * Smoke audit GWA — page/module HTTP checks → debug-d90786.log (NDJSON)
 * Run: node scripts/smoke-audit.mjs
 */
import { appendFileSync, writeFileSync } from "fs"
import { join } from "path"

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3000"
const LOG = join(process.cwd(), "debug-d90786.log")
const PRODUCT_ID = process.env.SMOKE_PRODUCT_ID || "4a93f0e4-7367-4cf4-9c2b-0a331ee7425b"
const PROFILE_ID = process.env.SMOKE_PROFILE_ID || "53908007-1bdc-44c1-ad6b-a868592e887e"

writeFileSync(LOG, "", "utf8")

function log(entry) {
  appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: "d90786",
      runId: "smoke-audit",
      timestamp: Date.now(),
      ...entry,
    }) + "\n",
    "utf8",
  )
}

const PAGES = [
  { module: "public", path: "/" },
  { module: "public", path: "/agriculture" },
  { module: "marketplace", path: "/marketplace" },
  { module: "marketplace", path: `/produit/${PRODUCT_ID}` },
  { module: "marketplace", path: "/recherche" },
  { module: "marketplace", path: "/favoris" },
  { module: "auth", path: "/auth/login" },
  { module: "auth", path: "/auth/signup" },
  { module: "auth", path: "/auth/forgot-password" },
  { module: "auth", path: "/auth/onboarding" },
  { module: "legal", path: "/conditions" },
  { module: "legal", path: "/confidentialite" },
  { module: "contact", path: "/contact" },
  { module: "pwa", path: "/download" },
  { module: "coop", path: "/cooperatives" },
  { module: "coop", path: "/cooperatives/create" },
  { module: "coop", path: "/cooperatives/rejoindre" },
  { module: "scg", path: "/scg" },
  { module: "finance", path: "/wallet" },
  { module: "finance", path: "/affacturage" },
  { module: "finance", path: `/facture/${PRODUCT_ID}` },
  { module: "publish", path: "/publier" },
  { module: "cart", path: "/panier" },
  { module: "chat", path: "/messages" },
  { module: "notif", path: "/notifications" },
  { module: "profil", path: "/profil" },
  { module: "profil", path: "/profil/edit" },
  { module: "profil", path: `/profil/${PROFILE_ID}` },
  { module: "dashboard", path: "/dashboard" },
  { module: "dashboard", path: "/dashboard/farmer" },
  { module: "dashboard", path: "/dashboard/buyer" },
  { module: "dashboard", path: "/dashboard/cooperative" },
  { module: "dashboard", path: "/dashboard/products" },
  { module: "dashboard", path: "/dashboard/commandes" },
  { module: "dashboard", path: "/dashboard/reviews" },
  { module: "admin", path: "/admin" },
  { module: "admin", path: "/admin/users" },
  { module: "admin", path: "/admin/products" },
  { module: "admin", path: "/admin/orders" },
  { module: "admin", path: "/admin/factoring" },
  { module: "admin", path: "/admin/verifications" },
  { module: "admin", path: "/admin/disputes" },
  { module: "admin", path: "/admin/reports" },
  { module: "admin", path: "/admin/scg" },
  { module: "admin", path: "/admin/finances" },
  { module: "admin", path: "/admin/analytics" },
  { module: "admin", path: "/admin/settings" },
  { module: "redirect", path: "/communaute" },
  { module: "redirect", path: "/b2b" },
  { module: "redirect", path: "/artisans" },
  { module: "redirect", path: "/formations" },
  { module: "redirect", path: "/learning" },
  { module: "redirect", path: "/network" },
  { module: "dev", path: "/dev/routes" },
]

const APIS = [
  { module: "api-health", path: "/api/health", expectOk: true },
  { module: "api-weather", path: "/api/weather?lat=5.36&lon=-4.01", expectOk: true },
  { module: "api-products", path: "/api/products", expectAuthOrOk: true },
  { module: "api-auth", path: "/api/auth/me", expectStatus: [401, 200] },
  { module: "api-auth", path: "/api/auth/admin-status", expectStatus: [401, 200] },
  { module: "api-scg", path: `/api/scg/${PROFILE_ID}`, expectAuthOrOk: true },
  { module: "api-notif", path: "/api/notifications", expectStatus: [401, 200] },
  { module: "api-factoring", path: "/api/factoring", expectStatus: [401, 200, 405] },
  { module: "api-contact", path: "/api/contact", method: "GET", expectStatus: [405, 404, 200] },
]

async function hit(path, method = "GET") {
  const url = `${BASE}${path}`
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method,
      redirect: "manual",
      headers: { Accept: "text/html,application/json" },
    })
    const ms = Date.now() - t0
    const loc = res.headers.get("location")
    let bodyHint = ""
    if (res.status >= 400 && res.status < 600) {
      const text = await res.text().catch(() => "")
      bodyHint = text.slice(0, 200).replace(/\s+/g, " ")
    }
    return {
      status: res.status,
      ms,
      location: loc,
      bodyHint,
      ok: res.status >= 200 && res.status < 400,
    }
  } catch (err) {
    return {
      status: 0,
      ms: Date.now() - t0,
      location: null,
      bodyHint: String(err?.message || err).slice(0, 200),
      ok: false,
    }
  }
}

function classifyPage(r, path) {
  // Protected → redirect login is OK
  if ([301, 302, 303, 307, 308].includes(r.status) && r.location) {
    const loc = r.location
    if (loc.includes("/auth/login")) return "auth_redirect_ok"
    if (path.startsWith("/admin") && loc.includes("/dashboard")) return "admin_denied_ok"
    return "redirect"
  }
  if (r.status === 200) return "ok"
  if (r.status === 404) return "not_found"
  if (r.status >= 500) return "server_error"
  if (r.status === 0) return "connection_failed"
  return "unexpected"
}

async function main() {
  log({
    hypothesisId: "SMOKE",
    location: "smoke-audit",
    message: "start",
    data: { base: BASE, productId: PRODUCT_ID },
  })

  const summary = { ok: 0, warn: 0, fail: 0, byModule: {} }

  for (const p of PAGES) {
    const r = await hit(p.path)
    const kind = classifyPage(r, p.path)
    const fail = kind === "server_error" || kind === "connection_failed" || kind === "not_found"
    const warn = kind === "unexpected"
    if (fail) summary.fail++
    else if (warn) summary.warn++
    else summary.ok++

    summary.byModule[p.module] = summary.byModule[p.module] || { ok: 0, fail: 0, warn: 0 }
    if (fail) summary.byModule[p.module].fail++
    else if (warn) summary.byModule[p.module].warn++
    else summary.byModule[p.module].ok++

    log({
      hypothesisId: fail ? "H1" : warn ? "H2" : "H0",
      location: `page:${p.path}`,
      message: kind,
      data: {
        module: p.module,
        status: r.status,
        ms: r.ms,
        location: r.location,
        bodyHint: r.bodyHint || undefined,
      },
    })
  }

  for (const a of APIS) {
    const r = await hit(a.path, a.method || "GET")
    const allowed = a.expectStatus || (a.expectOk ? [200] : [200, 401, 403, 405])
    const pass = allowed.includes(r.status) || (a.expectAuthOrOk && (r.status === 200 || r.status === 401))
    if (pass) summary.ok++
    else if (r.status >= 500 || r.status === 0) summary.fail++
    else summary.warn++

    log({
      hypothesisId: pass ? "H0" : "H3",
      location: `api:${a.path}`,
      message: pass ? "api_ok" : "api_unexpected",
      data: {
        module: a.module,
        status: r.status,
        ms: r.ms,
        bodyHint: r.bodyHint || undefined,
      },
    })
  }

  log({
    hypothesisId: "SMOKE",
    location: "smoke-audit",
    message: "summary",
    data: summary,
  })

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => {
  log({
    hypothesisId: "SMOKE",
    location: "smoke-audit",
    message: "fatal",
    data: { err: String(e) },
  })
  console.error(e)
  process.exit(1)
})
