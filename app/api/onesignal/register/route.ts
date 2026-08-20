import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const playerId = body?.onesignal_player_id ?? body?.player_id

    if (!playerId || typeof playerId !== "string" || playerId.length < 8) {
      return NextResponse.json(
        { error: "Identifiant OneSignal invalide" },
        { status: 400 },
      )
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        onesignal_player_id: playerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id, onesignal_player_id")
      .maybeSingle()

    if (error) {
      console.error("[onesignal/register]", error.message)
      return NextResponse.json(
        { error: "Impossible d'enregistrer le token push" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      profile_id: profile?.id,
      onesignal_player_id: profile?.onesignal_player_id,
    })
  } catch (err) {
    console.error("[onesignal/register]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
