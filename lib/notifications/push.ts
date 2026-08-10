<<<<<<< Updated upstream
import {
  getOneSignalAppId,
  getOneSignalRestApiKey,
} from "@/lib/notifications/onesignal-config"

const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications"

export interface PushNotificationPayload {
  playerIds?: string[]
  externalUserIds?: string[]
  title: string
  body: string
  data?: Record<string, unknown>
  url?: string
}

export interface PushNotificationResult {
  success: boolean
  id?: string
  error?: string
}

export { getOneSignalAppId } from "@/lib/notifications/onesignal-config"

export async function sendPushNotification(
  payload: PushNotificationPayload,
): Promise<PushNotificationResult> {
  const appId = getOneSignalAppId()
  const apiKey = getOneSignalRestApiKey()

  if (!appId) {
    console.error("[push] NEXT_PUBLIC_ONESIGNAL_APP_ID manquant ou invalide")
    return { success: false, error: "Configuration OneSignal incomplète" }
  }

  if (!apiKey) {
    console.error("[push] ONESIGNAL_REST_API_KEY manquante")
    return { success: false, error: "Configuration OneSignal incomplète" }
  }

  const hasPlayers = (payload.playerIds?.length ?? 0) > 0
  const hasExternal = (payload.externalUserIds?.length ?? 0) > 0
  if (!hasPlayers && !hasExternal) {
    return { success: false, error: "Aucun destinataire" }
  }

  try {
    const body: Record<string, unknown> = {
      app_id: appId,
      headings: { fr: payload.title, en: payload.title },
      contents: { fr: payload.body, en: payload.body },
      data: payload.data ?? {},
    }
    if (payload.url) body.url = payload.url
    if (hasPlayers) body.include_player_ids = payload.playerIds
    if (hasExternal) {
      body.include_aliases = { external_id: payload.externalUserIds }
      body.target_channel = "push"
    }

    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error("[push]", result)
      return {
        success: false,
        error: result.errors?.[0] ?? "Envoi push échoué",
      }
    }

    return { success: true, id: result.id }
  } catch (err) {
    console.error("[push]", err)
    return { success: false, error: "Erreur réseau OneSignal" }
  }
}

export async function sendPushToUser(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { onesignal_player_id?: string | null } | null
          }>
        }
      }
    }
  },
  userId: string,
  notification: Omit<PushNotificationPayload, "playerIds" | "externalUserIds">,
): Promise<PushNotificationResult> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("onesignal_player_id")
    .eq("id", userId)
    .maybeSingle()

  if (profile?.onesignal_player_id) {
    return sendPushNotification({
      ...notification,
      playerIds: [profile.onesignal_player_id],
    })
  }

  // Fallback : external_id = userId Supabase (OneSignal.login)
  return sendPushNotification({
    ...notification,
    externalUserIds: [userId],
  })
=======
/**
 * GWA — F5 Push notifications via OneSignal REST API
 */
import type { SupabaseClient } from "@supabase/supabase-js"

// Credentials OneSignal GWA
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID ?? "5f01e343-a7a2-4ae8-8baa-655388e239bc"
const ONESIGNAL_REST_API_KEY =
  process.env.ONESIGNAL_REST_API_KEY ??
  "os_v2_app_l4a6gq5hujforc5kmvjyryrzxqraxsoltttevmfaz7ymsfxp2n7t2yc5rk43cnlgshtpgachxjc3n3iespkw2pikqmecch6v272vaoy"

interface PushPayload {
  title: string
  body: string
  data?: Record<string, unknown>
}

/**
 * Envoie une notification push à un utilisateur via son external_user_id OneSignal.
 * Si supabase est fourni, tente d'abord de cibler via onesignal_player_id enregistré.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
  supabase?: SupabaseClient
): Promise<void> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) return

  try {
    // Essayer de récupérer le player_id enregistré en DB si supabase fourni
    let filters: unknown[]
    if (supabase) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onesignal_player_id")
        .eq("id", userId)
        .maybeSingle()

      if (profile?.onesignal_player_id) {
        filters = [{ field: "player_id", value: profile.onesignal_player_id }]
      } else {
        filters = [{ field: "external_user_id", value: userId }]
      }
    } else {
      filters = [{ field: "external_user_id", value: userId }]
    }

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters,
        headings: { fr: payload.title, en: payload.title },
        contents: { fr: payload.body, en: payload.body },
        data: payload.data ?? {},
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error("[GWA] OneSignal push error:", err)
    }
  } catch (err) {
    console.error("[GWA] OneSignal push exception:", err)
  }
}

export async function sendPushToMultiple(
  userIds: string[],
  payload: PushPayload,
  supabase?: SupabaseClient
): Promise<void> {
  await Promise.allSettled(userIds.map((id) => sendPushNotification(id, payload, supabase)))
}

/**
 * Enregistre le player_id OneSignal en base pour un utilisateur.
 */
export async function registerDevice(
  userId: string,
  playerId: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ onesignal_player_id: playerId })
    .eq("id", userId)
>>>>>>> Stashed changes
}
