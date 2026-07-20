import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * POST /api/cooperatives/join
 * Un utilisateur authentifié rejoint une coopérative via un lien d'invitation.
 * Body: { coop_id: string }
 * Effet : membre actif dans cooperative_members + profiles.coop_id.
 */
export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const coopId = String(body?.coop_id || "")
    if (!coopId) {
      return NextResponse.json({ error: "coop_id requis" }, { status: 400 })
    }

    const { data: coop } = await supabase
      .from("cooperatives")
      .select("id, name")
      .eq("id", coopId)
      .maybeSingle()

    if (!coop) {
      return NextResponse.json({ error: "Coopérative introuvable" }, { status: 404 })
    }

    // Membre déjà présent ?
    const { data: existing } = await supabase
      .from("cooperative_members")
      .select("id")
      .eq("cooperative_id", coopId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      const { error: memberErr } = await supabase
        .from("cooperative_members")
        .insert({ cooperative_id: coopId, user_id: user.id, role: "member", is_active: true })
      if (memberErr) {
        console.error("[api/cooperatives/join] member insert", memberErr.message)
        return NextResponse.json({ error: "Impossible de rejoindre" }, { status: 500 })
      }
    }

    await supabase.from("profiles").update({ coop_id: coopId }).eq("id", user.id)

    return NextResponse.json({ success: true, cooperative: coop })
  } catch (err) {
    console.error("[api/cooperatives/join]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
