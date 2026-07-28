import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { assertSameOrigin } from "@/lib/security/csrf"

/**
 * POST /api/cooperatives/join
 * Un utilisateur authentifié rejoint une coopérative via un lien d'invitation.
 * Body: { coop_id: string }
 * Effet : membre actif (rôle member) + profiles.coop_id via service_role
 * (coop_id est gelé en self-service — trigger 049).
 */
export async function POST(request: Request) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

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

    const body = await request.json().catch(() => null)
    const coopId = String(body?.coop_id || "")
    if (!coopId) {
      return NextResponse.json({ error: "coop_id requis" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: coop } = await admin
      .from("cooperatives")
      .select("id, name")
      .eq("id", coopId)
      .maybeSingle()

    if (!coop) {
      return NextResponse.json({ error: "Coopérative introuvable" }, { status: 404 })
    }

    const { data: existing } = await admin
      .from("cooperative_members")
      .select("id, role")
      .eq("cooperative_id", coopId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      const { error: memberErr } = await admin.from("cooperative_members").insert({
        cooperative_id: coopId,
        user_id: user.id,
        role: "member",
        is_active: true,
      })
      if (memberErr) {
        console.error("[api/cooperatives/join] member insert", memberErr.message)
        return NextResponse.json({ error: "Impossible de rejoindre" }, { status: 500 })
      }
    } else {
      await admin
        .from("cooperative_members")
        .update({ is_active: true })
        .eq("id", existing.id)
    }

    // service_role requis : trigger 049 gèle coop_id en self-service
    await admin.from("profiles").update({ coop_id: coopId }).eq("id", user.id)

    return NextResponse.json({ success: true, cooperative: coop })
  } catch (err) {
    console.error("[api/cooperatives/join]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
