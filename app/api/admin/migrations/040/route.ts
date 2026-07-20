import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { applyMigration040, checkMigration040Status } from "@/lib/db/migration-040"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** GET /api/admin/migrations/040 — statut ou ?apply=1 */
export async function GET(request: Request) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const url = new URL(request.url)
    const shouldApply = url.searchParams.get("apply") === "1"
    const status = await checkMigration040Status()

    if (!shouldApply) {
      return NextResponse.json({ migration: "040_harmattan_digest", ...status })
    }

    if (status.applied) {
      return NextResponse.json({
        migration: "040_harmattan_digest",
        ok: true,
        alreadyApplied: true,
        ...status,
      })
    }

    if (!status.postgresConfigured) {
      return NextResponse.json(
        { error: "POSTGRES_URL_NON_POOLING manquant", ...status },
        { status: 503 },
      )
    }

    await applyMigration040()
    const after = await checkMigration040Status()

    return NextResponse.json({
      migration: "040_harmattan_digest",
      ok: true,
      applied: true,
      before: status,
      after,
    })
  } catch (err) {
    console.error("[migrations/040 GET]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur migration 040" },
      { status: 500 },
    )
  }
}

export async function POST() {
  try {
    const gate = await requireSuperAdmin()
    if (!gate.isAdmin) {
      return NextResponse.json({ error: gate.error || "Accès refusé" }, { status: 403 })
    }

    const before = await checkMigration040Status()
    if (!before.postgresConfigured) {
      return NextResponse.json({ error: "POSTGRES_URL_NON_POOLING manquant" }, { status: 503 })
    }

    await applyMigration040()
    const after = await checkMigration040Status()

    return NextResponse.json({ migration: "040_harmattan_digest", ok: true, before, after })
  } catch (err) {
    console.error("[migrations/040 POST]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur migration 040" },
      { status: 500 },
    )
  }
}
