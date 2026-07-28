"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { getOneSignalAppId } from "@/lib/notifications/onesignal-config"

type PushStatus = {
  configured: boolean
  playerRegistered?: boolean
  onesignalPlayerId?: string | null
  permission?: NotificationPermission | "unsupported"
}

/**
 * Carte Activer / Tester les push OneSignal — surface /notifications.
 */
export function PushSettingsCard() {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const appId = getOneSignalAppId()

  const refresh = async () => {
    try {
      const res = await fetch("/api/push/status")
      if (res.status === 401) return
      const data = await res.json().catch(() => ({}))
      setStatus({
        configured: !!data.configured,
        playerRegistered: !!data.playerId,
        onesignalPlayerId: data.playerId ?? null,
        permission:
          typeof Notification !== "undefined"
            ? Notification.permission
            : "unsupported",
      })
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const enable = async () => {
    if (!appId) {
      toast.error("OneSignal non configuré (NEXT_PUBLIC_ONESIGNAL_APP_ID)")
      return
    }
    setBusy(true)
    try {
      const os = window.OneSignal
      if (os?.Notifications?.requestPermission) {
        await os.Notifications.requestPermission()
      } else if (typeof Notification !== "undefined") {
        await Notification.requestPermission()
      }
      if (os?.User?.PushSubscription?.optIn) {
        await os.User.PushSubscription.optIn()
      }
      const playerId = os?.User?.PushSubscription?.id
      if (playerId) {
        await fetch("/api/onesignal/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onesignal_player_id: playerId }),
        })
      }
      await refresh()
      if (window.__GWA_ONESIGNAL_STATUS && !window.__GWA_ONESIGNAL_STATUS.ok) {
        toast.error(
          /not configured for web push/i.test(window.__GWA_ONESIGNAL_STATUS.error || "")
            ? "Domaine non autorisé dans OneSignal Dashboard"
            : window.__GWA_ONESIGNAL_STATUS.error || "Init OneSignal échouée",
        )
      } else {
        toast.success("Permission demandée — accepte dans le navigateur")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Permission refusée")
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/push/status", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Test push impossible")
        return
      }
      toast.success(data.message || "Notification de test envoyée")
      await refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        {status?.permission === "granted" ? (
          <Bell className="h-5 w-5 text-[#1F5C2E] shrink-0 mt-0.5" />
        ) : (
          <BellOff className="h-5 w-5 text-[#9CA3AF] shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#111827]">Notifications push</p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {!appId
              ? "Notifications indisponibles."
              : status?.permission === "granted"
                ? status.playerRegistered
                  ? "Activées."
                  : "Enregistrement…"
                : "Alertes commandes et messages."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !appId}
          onClick={enable}
          className="bg-transparent"
        >
          <Bell className="h-3.5 w-3.5 mr-1.5" />
          Activer
        </Button>
        <Button
          size="sm"
          className="bg-[#1F5C2E] hover:bg-[#174a24]"
          disabled={busy || !appId || status?.permission !== "granted"}
          onClick={sendTest}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Tester
        </Button>
      </div>
    </div>
  )
}
