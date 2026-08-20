/**
 * Auth cron résiliente :
 * 1. Bearer CRON_SECRET (obligatoire en production)
 * 2. Header natif x-vercel-cron=1 UNIQUEMENT en complément du Bearer
 * 3. Dev local sans secret
 */

function clean(value: string | undefined): string {
  return (value || "").replace(/^"|"$/g, "").trim()
}

export function getCronSecret(): string {
  return clean(process.env.CRON_SECRET)
}

export function authorizeCronRequest(request: Request): {
  ok: boolean
  via: "bearer" | "vercel-cron+bearer" | "dev" | null
} {
  const secret = getCronSecret()
  const auth = request.headers.get("authorization") || ""
  const vercelCron = request.headers.get("x-vercel-cron") === "1"
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"

  if (secret && auth === `Bearer ${secret}`) {
    return {
      ok: true,
      via: vercelCron ? "vercel-cron+bearer" : "bearer",
    }
  }

  // En prod : jamais le header Vercel seul (forgeable hors edge)
  if (isProd) {
    return { ok: false, via: null }
  }

  if (process.env.NODE_ENV === "development" && !secret) {
    return { ok: true, via: "dev" }
  }

  return { ok: false, via: null }
}
