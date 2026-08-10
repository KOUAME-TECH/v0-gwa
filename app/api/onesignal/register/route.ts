<<<<<<< Updated upstream
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
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
=======
/**
 * POST /api/onesignal/register — Enregistrer le player_id OneSignal
 * Body: { onesignal_player_id: string }
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { registerDevice } from "@/lib/notifications/push"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const body = await request.json()
    const { onesignal_player_id } = body as { onesignal_player_id?: string }

    if (!onesignal_player_id || typeof onesignal_player_id !== "string" || onesignal_player_id.trim() === "") {
      return NextResponse.json({ error: "onesignal_player_id requis" }, { status: 400 })
    }

    await registerDevice(user.id, onesignal_player_id.trim(), supabase)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[GWA] POST /api/onesignal/register exception:", err)
>>>>>>> Stashed changes
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
