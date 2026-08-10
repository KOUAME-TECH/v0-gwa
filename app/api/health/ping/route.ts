import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/health/ping
 *
 * Endpoint ultra-léger pour UptimeRobot / cron-job.org / probes externes.
 * Pas de DB, pas de secrets — réponse rapide HTTP 200 + mot-clé `pong`.
 *
 * Pour un check plus riche (DB, secrets booléens) → GET /api/health
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "GWA Platform",
      ping: "pong",
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  )
}
