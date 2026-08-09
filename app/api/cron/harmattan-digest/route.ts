import { NextResponse } from "next/server"
import { runHarmattanDigest } from "@/lib/notifications/harmattan-digest"
import { authorizeCronRequest } from "@/lib/security/cron-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 120
export const runtime = "nodejs"

/**
 * POST|GET /api/cron/harmattan-digest
 *
 * Déclencheur push OneSignal + secours manuel.
 *
 * Planning :
 * 1. **Principal** — Supabase pg_cron `gwa-harmattan-digest-daily` (06:00 UTC)
 *    → `SELECT public.run_harmattan_digest();` (migration 041, in-app)
 * 2. **Backup** — Vercel Cron `vercel.json` → GET this route (06:00 UTC)
 * 3. **Manuel** — Bearer CRON_SECRET | x-vercel-cron | DIGEST_INTERNAL_KEY
 */
async function handle(request: Request) {
  const auth = authorizeCronRequest(request)
  const internal = (process.env.DIGEST_INTERNAL_KEY || "").trim()
  const headerKey = request.headers.get("x-gwa-digest-key") || ""
  const okInternal = !!(internal && headerKey && headerKey === internal)

  if (!auth.ok && !okInternal) {
    return NextResponse.json(
      {
        error: "Non autorisé",
        hint: "Planning principal = Supabase pg_cron. Manuel: Bearer CRON_SECRET ou x-gwa-digest-key.",
      },
      { status: 401 },
    )
  }

  try {
    const result = await runHarmattanDigest()
    return NextResponse.json({
      ok: true,
      auth_via: okInternal ? "digest_internal_key" : auth.via,
      note: "Push OneSignal (secours). In-app digest planifié via Supabase pg_cron.",
      ...result,
    })
  } catch (err) {
    console.error("[cron/harmattan-digest]", err)
    return NextResponse.json(
      {
        ok: false,
        auth_via: okInternal ? "digest_internal_key" : auth.via,
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
