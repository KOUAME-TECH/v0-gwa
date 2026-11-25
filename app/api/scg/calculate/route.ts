import { type NextRequest, NextResponse } from "next/server"
import { assertSameOrigin } from "@/lib/security/csrf"
import { createClient } from "@/lib/supabase/server"
import { aggregateProducerData } from "@/lib/scg/aggregate"
import { calculateSCG } from "@/lib/scg/engine"
import { persistScgResult } from "@/lib/scg/persist"

/**
 * POST /api/scg/calculate
 * Calcule le SCG du producteur connecté (ou d'un userId fourni si admin actif).
 */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request)
  if (csrf) return csrf

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
    await persistScgResult(targetUserId, result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[api/scg/calculate]", error)
    return NextResponse.json({ error: "Erreur lors du calcul du SCG" }, { status: 500 })
  }
}
