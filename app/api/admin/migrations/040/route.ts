import { NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { assertSameOrigin } from "@/lib/security/csrf"
import { applyMigration040, checkMigration040Status } from "@/lib/db/migration-040"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** GET — statut uniquement (super_admin). Apply via POST. */
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

    const status = await checkMigration040Status()
    return NextResponse.json({ migration: "040_harmattan_digest", ...status })
  } catch (err) {
    console.error("[migrations/040 GET]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur migration 040" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

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
