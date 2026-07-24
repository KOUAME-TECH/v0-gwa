"use client"

import { useEffect } from "react"

/**
 * Enregistre le même worker que OneSignal (dashboard Typical Site).
 * Contenu = offline GWA + OneSignal SDK (public/OneSignalSDKWorker.js).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/OneSignalSDKWorker.js", { scope: "/" })
      .catch(() => {
        // Non bloquant en dev ou navigateurs sans SW
      })
  }, [])

  return null
}
