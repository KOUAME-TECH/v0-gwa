import { NextResponse } from "next/server"
import { runHarmattanDigest } from "@/lib/notifications/harmattan-digest"

export const dynamic = "force-dynamic"
export const maxDuration = 120

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

/**
 * GET /api/cron/harmattan-digest
 * Vercel Cron — digest vocal quotidien (06:00 UTC).
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const result = await runHarmattanDigest()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/harmattan-digest]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur digest" },
      { status: 500 },
    )
  }
}
