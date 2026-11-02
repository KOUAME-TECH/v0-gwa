import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { assertSameOrigin } from "@/lib/security/csrf"
import {
  applyMigration039,
  checkMigration039Status,
} from "@/lib/db/migration-039"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * GET /api/admin/migrations/039 — statut uniquement (super_admin).
 * Apply uniquement via POST.
 */
export async function GET() {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireSuperAdmin()
    if (!gate.isAdmin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const status = await checkMigration039Status()
    return NextResponse.json({
      migration: "039_comment_voice_listen",
      ...status,
    })
  } catch (err) {
    console.error("[migrations/039 GET]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur migration 039" },
      { status: 500 },
    )
  }
}

/** POST — super admin uniquement (application). */
export async function POST(request: Request) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

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
