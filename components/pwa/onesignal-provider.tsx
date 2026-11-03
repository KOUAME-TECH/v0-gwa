"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  getOneSignalAppId,
  isOneSignalOriginAllowed,
} from "@/lib/notifications/onesignal-config"

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
    __GWA_ONESIGNAL_ORIGIN_WARNED?: boolean
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

function warnOriginOnce(origin: string) {
  if (typeof window === "undefined") return
  if (window.__GWA_ONESIGNAL_ORIGIN_WARNED) return
  window.__GWA_ONESIGNAL_ORIGIN_WARNED = true
  console.warn(
    `[OneSignal] Origine ${origin} absente du dashboard — ajoutez-la dans Settings → Platforms → Web (Typical Site). Sites requis : https://mygwa.org et https://v0-gwa-gwa.vercel.app`,
  )
}

/**
 * Si OneSignal a laissé un SW cassé / partiel après init échouée (domaine dashboard),
 * unregister les workers OS puis ré-enregistrer `/sw.js` offline (pass-through auth).
 */
async function softRecoverOfflineWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs.map(async (reg) => {
        const script =
          reg.active?.scriptURL ||
          reg.waiting?.scriptURL ||
          reg.installing?.scriptURL ||
          ""
        if (
          script.includes("OneSignalSDKWorker") ||
          script.includes("OneSignalSDKUpdaterWorker")
        ) {
          await reg.unregister()
        }
      }),
    )
    await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  } catch {
    // non bloquant
  }
}

/**
 * OneSignal Web SDK v16 — PWA
 * Aligné dashboard Typical Site :
 *   Main Filename → OneSignalSDKWorker.js
 *   Updater Filename → OneSignalSDKUpdaterWorker.js
 *   Path / Registration Scope → /
 * Workers : offline GWA + OneSignal CDN v16 (pass-through supabase/maps).
 */
export function OneSignalProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || typeof window === "undefined") return
    initialized.current = true

    const origin = window.location.origin
    const appId = getOneSignalAppId()
    if (!appId) {
      window.__GWA_ONESIGNAL_STATUS = {
        ok: false,
        error: "NEXT_PUBLIC_ONESIGNAL_APP_ID manquant",
        origin,
      }
      return
    }

    // Skip init hors allowlist — évite throw uncaught ; offline via /sw.js
    if (!isOneSignalOriginAllowed(origin)) {
      warnOriginOnce(origin)
      window.__GWA_ONESIGNAL_STATUS = {
        ok: false,
        error: "domain_not_allowed",
        origin,
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
          origin,
          playerId: OneSignal.User.PushSubscription.id || null,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Domaine non autorisé côté dashboard malgré allowlist code
        const domainBlocked = /can only be used on|not configured for web push|domain/i.test(
          msg,
        )
        if (domainBlocked) {
          warnOriginOnce(origin)
          void softRecoverOfflineWorker()
        } else {
          console.warn("[OneSignal] init échouée (App ID / SW / domaine) :", err)
        }
        window.__GWA_ONESIGNAL_STATUS = {
          ok: false,
          error: domainBlocked ? "domain_not_allowed" : msg,
          origin,
        }
        return
      }

      const sync = async () => {
        const playerId = OneSignal.User.PushSubscription.id
        window.__GWA_ONESIGNAL_STATUS = {
          ok: true,
          origin,
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
        // Permission uniquement après geste utilisateur (ex. /notifications → Activer)
        await sync()
      } else {
        await sync()
      }
    })

    // Charge le SDK OneSignal hors chemin critique (idle / après 4s)
    const inject = () => {
      if (document.querySelector('script[data-onesignal="true"]')) return
      const script = document.createElement("script")
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      script.defer = true
      script.dataset.onesignal = "true"
      document.head.appendChild(script)
    }
    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => inject(), { timeout: 5000 })
    } else {
      timer = setTimeout(inject, 4000)
    }
    return () => {
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timer) clearTimeout(timer)
    }
  }, [])

  return <>{children}</>
}
