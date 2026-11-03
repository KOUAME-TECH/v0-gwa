"use client"

import { useEffect } from "react"
import { isOneSignalOriginAllowed } from "@/lib/notifications/onesignal-config"

/**
 * Enregistre le worker offline GWA.
 * - Origine allowlistée OneSignal → laisse OneSignal.init enregistrer
 *   `OneSignalSDKWorker.js` (même contenu offline + SDK) pour éviter double register.
 * - Sinon → `/sw.js` (même logique offline, pass-through supabase/maps) sans push OS.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    const origin = window.location.origin
    if (isOneSignalOriginAllowed(origin)) {
      // OneSignalProvider enregistrera OneSignalSDKWorker.js après idle inject
      return
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Non bloquant en dev ou navigateurs sans SW
      })
  }, [])

  return null
}
