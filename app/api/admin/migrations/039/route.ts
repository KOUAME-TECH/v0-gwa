import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  applyMigration039,
  checkMigration039Status,
} from "@/lib/db/migration-039"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * GET /api/admin/migrations/039
 * - ?apply=1 : applique la migration si absente (idempotent, rate-limit)
 * - sinon : statut uniquement
 */
export async function GET(request: Request) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const url = new URL(request.url)
    const shouldApply = url.searchParams.get("apply") === "1"

    const status = await checkMigration039Status()

    if (!shouldApply) {
      return NextResponse.json({
        migration: "039_comment_voice_listen",
        ...status,
      })
    }

    if (status.applied) {
      return NextResponse.json({
        migration: "039_comment_voice_listen",
        ok: true,
        alreadyApplied: true,
        ...status,
      })
    }

    if (!status.postgresConfigured) {
      return NextResponse.json(
        {
          error:
            "Connexion Postgres non configurée sur Vercel (POSTGRES_URL_NON_POOLING). Appliquez le SQL manuellement dans Supabase.",
          ...status,
        },
        { status: 503 },
      )
    }

    await applyMigration039()
    const after = await checkMigration039Status()

    return NextResponse.json({
      migration: "039_comment_voice_listen",
      ok: true,
      applied: true,
      before: status,
      after,
    })
  } catch (err) {
    console.error("[migrations/039 GET]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur migration 039" },
      { status: 500 },
    )
  }
}

/** POST — super admin uniquement (application forcée). */
export async function POST() {
  try {
    const gate = await requireSuperAdmin()
    if (!gate.isAdmin) {
      return NextResponse.json({ error: gate.error || "Accès refusé" }, { status: 403 })
    }

    const before = await checkMigration039Status()
    if (!before.postgresConfigured) {
      return NextResponse.json(
        { error: "POSTGRES_URL_NON_POOLING manquant sur Vercel" },
        { status: 503 },
      )
    }

    await applyMigration039()
    const after = await checkMigration039Status()

    return NextResponse.json({
      migration: "039_comment_voice_listen",
      ok: true,
      before,
      after,
    })
  } catch (err) {
    console.error("[migrations/039 POST]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur migration 039" },
      { status: 500 },
    )
  }
}
