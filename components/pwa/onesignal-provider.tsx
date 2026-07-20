"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { getOneSignalAppId } from "@/lib/notifications/onesignal-config"

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => void | Promise<void>>
    OneSignal?: OneSignalSDK
  }
}

interface OneSignalSDK {
  init(options: {
    appId: string
    allowLocalhostAsSecureOrigin?: boolean
    serviceWorkerPath?: string
    serviceWorkerUpdaterPath?: string
    serviceWorkerParam?: { scope: string }
    notifyButton?: { enable: boolean }
  }): Promise<void>
  login?(externalId: string): Promise<void>
  User: {
    PushSubscription: {
      id?: string | null
      optedIn?: boolean
      addEventListener: (event: string, listener: () => void) => void
    }
  }
  Notifications: {
    requestPermission(): Promise<boolean | void>
    permission?: boolean
  }
}

async function registerPlayerId(playerId: string) {
  try {
    await fetch("/api/onesignal/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onesignal_player_id: playerId }),
    })
  } catch {
    // non bloquant
  }
}

/**
 * OneSignal Web SDK v16 — PWA (pas Expo/RN)
 * App ID public ; REST API key côté serveur uniquement.
 */
export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || typeof window === "undefined") return
    initialized.current = true

    const appId = getOneSignalAppId()
    if (!appId) {
      console.warn(
        "[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID manquant ou invalide — init push ignorée",
      )
      return
    }

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
          notifyButton: { enable: false },
        })
      } catch (err) {
        console.warn("[OneSignal] init échouée (App ID / SW / cache) :", err)
        return
      }

      const sync = async () => {
        const playerId = OneSignal.User.PushSubscription.id
        if (playerId) await registerPlayerId(playerId)
      }

      await sync()
      OneSignal.User.PushSubscription.addEventListener("change", sync)

      // Lier l'utilisateur Supabase (external_id) si connecté
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.id && OneSignal.login) {
          await OneSignal.login(user.id)
        }
      } catch {
        // ignore
      }

      if (!OneSignal.User.PushSubscription.optedIn) {
        try {
          await OneSignal.Notifications.requestPermission()
          await sync()
        } catch {
          // permission refusée
        }
      }
    })

    if (!document.querySelector('script[data-onesignal="true"]')) {
      const script = document.createElement("script")
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      script.defer = true
      script.dataset.onesignal = "true"
      document.head.appendChild(script)
    }
  }, [])

  return <>{children}</>
}
