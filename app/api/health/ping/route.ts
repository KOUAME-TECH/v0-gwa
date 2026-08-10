import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/health/ping
 * Probe légère UptimeRobot / cron-job.org — mot-clé `pong`.
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
