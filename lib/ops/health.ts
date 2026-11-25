import { requireAdmin } from "@/lib/auth/require-admin"
import { authorizeCronRequest } from "@/lib/security/cron-auth"

export const PUBLIC_HEALTH_KEYS = ["status", "version", "db"] as const

/** Même URL pour le ping public et le détail ops : ne pas laisser un cache partagé rejouer le détail. */
export const HEALTH_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization, Cookie",
}

export function publicHealthBody(dbStatus: string) {
  const healthy = dbStatus === "connected"
  return {
    status: healthy ? "healthy" : "degraded",
    version: "2.0.0",
    db: dbStatus,
  }
}

/** Détails ops : Bearer CRON_SECRET uniquement (pas x-vercel-cron ni le mode dev). */
export function isHealthCronBearerAuthorized(request: Request): boolean {
  return authorizeCronRequest(request).via === "bearer"
}

export async function isHealthOpsAuthorized(request: Request): Promise<boolean> {
  if (isHealthCronBearerAuthorized(request)) return true
  try {
    const gate = await requireAdmin()
    return Boolean(gate.user && gate.isAdmin)
  } catch {
    return false
  }
}
