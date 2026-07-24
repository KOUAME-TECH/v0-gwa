"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { getOneSignalAppId } from "@/lib/notifications/onesignal-config"

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalSDK) => void | Promise<void>>
    OneSignal?: OneSignalSDK
    __GWA_ONESIGNAL_STATUS?: {
      ok: boolean
      error?: string
      origin?: string
      playerId?: string | null
    }
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
      optIn?: () => Promise<void>
      addEventListener: (event: string, listener: () => void) => void
    }
    addTag?: (key: string, value: string) => void
    addTags?: (tags: Record<string, string>) => void
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
 * OneSignal Web SDK v16 — PWA
 * Aligné dashboard Typical Site :
 *   Main Filename → OneSignalSDKWorker.js
 *   Updater Filename → OneSignalSDKUpdaterWorker.js
 *   Registration Scope → /
 * (Le worker principal embarque aussi le cache offline GWA.)
 */
export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || typeof window === "undefined") return
    initialized.current = true

    const appId = getOneSignalAppId()
    if (!appId) {
      window.__GWA_ONESIGNAL_STATUS = {
        ok: false,
        error: "NEXT_PUBLIC_ONESIGNAL_APP_ID manquant",
        origin: window.location.origin,
      }
      return
    }

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: "OneSignalSDKWorker.js",
          serviceWorkerUpdaterPath: "OneSignalSDKUpdaterWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false },
        })
        window.__GWA_ONESIGNAL_STATUS = {
          ok: true,
          origin: window.location.origin,
          playerId: OneSignal.User.PushSubscription.id || null,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn("[OneSignal] init échouée (App ID / SW / domaine) :", err)
        window.__GWA_ONESIGNAL_STATUS = {
          ok: false,
          error: msg,
          origin: window.location.origin,
        }
        // Domaine preview non déclaré dans OneSignal Dashboard → message actionnable
        if (/not configured for web push/i.test(msg)) {
          console.warn(
            `[OneSignal] Ajoutez l'origine ${window.location.origin} dans OneSignal → Settings → Platforms → Web`,
          )
        }
        return
      }

      const sync = async () => {
        const playerId = OneSignal.User.PushSubscription.id
        window.__GWA_ONESIGNAL_STATUS = {
          ok: true,
          origin: window.location.origin,
          playerId: playerId || null,
        }
        if (playerId) await registerPlayerId(playerId)
      }

      await sync()
      OneSignal.User.PushSubscription.addEventListener("change", () => {
        void sync()
      })

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.id && OneSignal.login) {
          await OneSignal.login(user.id)
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle()
          const role = (profile?.user_type || "acheteur").toString()
          if (OneSignal.User.addTags) {
            OneSignal.User.addTags({ role, platform: "web_pwa" })
          } else if (OneSignal.User.addTag) {
            OneSignal.User.addTag("role", role)
          }
        }
      } catch (err) {
        console.warn("[OneSignal] login/tags", err)
      }

      if (!OneSignal.User.PushSubscription.optedIn) {
        try {
          await OneSignal.Notifications.requestPermission()
          if (OneSignal.User.PushSubscription.optIn) {
            await OneSignal.User.PushSubscription.optIn()
          }
          await sync()
        } catch {
          // permission refusée
        }
      } else {
        await sync()
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
