import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { DIMENSION_META } from "@/lib/scg/engine"

/**
 * GET /api/admin/scg
 * Vue SCG v1 pour back-office : profils + dernier snapshot dimensions.
 */
export async function GET() {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdmin()
    if (!gate.isAdmin || !gate.admin) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    const admin = gate.admin

    const { data: profiles, error } = await admin
      .from("profiles")
      .select(
        "id, full_name, user_type, city, scg_score, scg_badge, scg_bancable, scg_calculated_at",
      )
      .not("scg_score", "is", null)
      .order("scg_score", { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = (profiles || []).map((p) => p.id)
    let latestByUser = new Map<
      string,
      {
        dim_fiabilite: number
        dim_qualite: number
        dim_engagement: number
        dim_volumes: number
        dim_stabilite: number
        recommandation: string | null
        created_at: string
      }
    >()

    if (ids.length > 0) {
      const { data: snapshots } = await admin
        .from("scg_scores")
        .select(
          "user_id, dim_fiabilite, dim_qualite, dim_engagement, dim_volumes, dim_stabilite, recommandation, created_at",
        )
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(500)

      for (const row of snapshots || []) {
        if (!latestByUser.has(row.user_id)) {
          latestByUser.set(row.user_id, row)
        }
      }
    }

    const rows = (profiles || []).map((p) => {
      const snap = latestByUser.get(p.id)
      return {
        ...p,
        dimensions: snap
          ? {
              fiabilite: snap.dim_fiabilite,
              qualite: snap.dim_qualite,
              engagement: snap.dim_engagement,
              volumes: snap.dim_volumes,
              stabilite: snap.dim_stabilite,
            }
          : null,
        recommandation: snap?.recommandation ?? null,
        snapshot_at: snap?.created_at ?? p.scg_calculated_at,
      }
    })

    return NextResponse.json({
      engine: "scg-v1",
      dimensions_meta: DIMENSION_META,
      thresholds: { bancable: 500, credit: 600, elite: 800 },
      note: "SCG v2 5C = post-bêta (roadmap CdC 12 mois)",
      users: rows,
    })
  } catch (err) {
    console.error("[api/admin/scg]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
