import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendPushToUser } from "@/lib/notifications/push"
import { getOneSignalAppId, getOneSignalRestApiKey } from "@/lib/notifications/onesignal-config"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * GET /api/push/status — diagnostic OneSignal (auth).
 * POST /api/push/status — envoie une notif test à soi-même.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onesignal_player_id")
    .eq("id", user.id)
    .maybeSingle()

  return NextResponse.json({
    configured: !!(getOneSignalAppId() && getOneSignalRestApiKey()),
    appIdPresent: !!getOneSignalAppId(),
    restKeyPresent: !!getOneSignalRestApiKey(),
    playerId: profile?.onesignal_player_id || null,
    externalId: user.id,
    hint: !profile?.onesignal_player_id
      ? "Autorise les notifications dans le navigateur puis recharge."
      : "POST /api/push/status pour un test push.",
  })
}

export async function POST() {
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

  if (!getOneSignalAppId() || !getOneSignalRestApiKey()) {
    return NextResponse.json(
      { error: "OneSignal non configuré (NEXT_PUBLIC_ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY)" },
      { status: 503 },
    )
  }

  const result = await sendPushToUser(supabase as never, user.id, {
    title: "Test GWA Push",
    body: "Ça marche — tes notifications OneSignal sont actives.",
    url: "/notifications",
    data: { type: "push_test" },
  })

  return NextResponse.json({
    ok: result.success,
    id: result.id,
    error: result.error,
  })
}
