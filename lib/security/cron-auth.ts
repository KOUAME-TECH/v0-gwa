/**
 * Auth cron résiliente :
 * 1. Bearer CRON_SECRET (recommandé Vercel)
 * 2. Header natif x-vercel-cron=1 (secours si secret mal synchronisé)
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
  via: "bearer" | "vercel-cron" | "dev" | null
} {
  const secret = getCronSecret()
  const auth = request.headers.get("authorization") || ""
  const vercelCron = request.headers.get("x-vercel-cron") === "1"

  if (secret && auth === `Bearer ${secret}`) {
    return { ok: true, via: "bearer" }
  }

  // Secours : invocation Vercel Cron (ne doit pas laisser le digest down)
  if (vercelCron) {
    return { ok: true, via: "vercel-cron" }
  }

  if (process.env.NODE_ENV === "development" && !secret) {
    return { ok: true, via: "dev" }
  }

  return { ok: false, via: null }
}
