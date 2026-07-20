import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { aggregateProducerData } from "@/lib/scg/aggregate"
import { calculateSCG } from "@/lib/scg/engine"

/**
 * POST /api/scg/calculate
 * Calcule le SCG du producteur connecté (ou d'un userId fourni si admin actif).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    let targetUserId = user.id
    const body = await request.json().catch(() => ({}))

    if (body?.userId && body.userId !== user.id) {
      const { data: adminRole } = await supabase
        .from("admin_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      if (!adminRole) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
      }
      targetUserId = body.userId
    }

    const data = await aggregateProducerData(targetUserId)
    const result = calculateSCG(data)
    const admin = createAdminClient()

    await admin.from("scg_scores").insert({
      user_id: targetUserId,
      score_total: result.score_total,
      badge: result.badge,
      bancable: result.bancable,
      dim_fiabilite: result.dimensions.fiabilite,
      dim_qualite: result.dimensions.qualite,
      dim_engagement: result.dimensions.engagement,
      dim_volumes: result.dimensions.volumes,
      dim_stabilite: result.dimensions.stabilite,
      recommandation: result.recommandation,
    })

    await admin
      .from("profiles")
      .update({
        scg_score: result.score_total,
        scg_badge: result.badge,
        scg_bancable: result.bancable,
        scg_calculated_at: result.calculated_at,
      })
      .eq("id", targetUserId)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/scg/calculate]", error)
    return NextResponse.json({ error: "Erreur lors du calcul du SCG" }, { status: 500 })
  }
}
