import { NextResponse } from "next/server"
import { runHarmattanDigest } from "@/lib/notifications/harmattan-digest"
import { authorizeCronRequest } from "@/lib/security/cron-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 120
export const runtime = "nodejs"

/**
 * GET|POST /api/cron/harmattan-digest
 * Vercel Cron — digest vocal quotidien (06:00 UTC).
 * Auth: Bearer CRON_SECRET OU header x-vercel-cron (secours).
 */
async function handle(request: Request) {
  const auth = authorizeCronRequest(request)
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: "Non autorisé",
        hint: "Authorization: Bearer $CRON_SECRET (ou job Vercel Cron)",
      },
      { status: 401 },
    )
  }

  try {
    const result = await runHarmattanDigest()
    return NextResponse.json({
      ok: true,
      auth_via: auth.via,
      ...result,
    })
  } catch (err) {
    console.error("[cron/harmattan-digest]", err)
    // Ne jamais faire planter le scheduler : réponse structurée
    return NextResponse.json(
      {
        ok: false,
        auth_via: auth.via,
        error: err instanceof Error ? err.message : "Erreur digest",
        usersProcessed: 0,
        pushesSent: 0,
        skippedNoProducts: 0,
        skippedOptOut: 0,
        errors: 1,
      },
      { status: 200 },
    )
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
