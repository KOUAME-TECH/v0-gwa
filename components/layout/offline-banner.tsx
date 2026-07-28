"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { WifiOff, Wifi, FilePenLine, ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { loadOfflineDraft } from "@/lib/offline/drafts"
import { loadCatalogCache } from "@/lib/offline/catalog-cache"
import { listPublishQueue } from "@/lib/offline/publish-queue"
import { flushPublishQueue } from "@/lib/offline/sync"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Status = "online" | "offline" | "restored"

export function OfflineBanner({ offsetForDesktopNav = false }: { offsetForDesktopNav?: boolean }) {
  const [status, setStatus] = useState<Status>("online")
  const [draftHint, setDraftHint] = useState(false)
  const [catalogHint, setCatalogHint] = useState(false)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    const refreshHints = async () => {
      try {
        const cache = loadCatalogCache()
        setCatalogHint(!!cache?.products?.length)

        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          setDraftHint(false)
          setQueueCount(0)
          return
        }
        const [product, post, queue] = await Promise.all([
          loadOfflineDraft(user.id, "product"),
          loadOfflineDraft(user.id, "post"),
          listPublishQueue(user.id),
        ])
        setDraftHint(!!(product || post))
        setQueueCount(queue.length)
      } catch {
        // ignore
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline")
      void refreshHints()
    }

    const goOff = () => {
      setStatus("offline")
      void refreshHints()
    }

    const goOn = async () => {
      setStatus("restored")
      const result = await flushPublishQueue()
      await refreshHints()
      if (result.flushed > 0) {
        toast.success(`${result.flushed} publication(s) synchronisée(s)`)
      }
      window.dispatchEvent(new CustomEvent("gwa:online-sync", { detail: result }))
      window.setTimeout(() => {
        setStatus("online")
        setDraftHint(false)
      }, 4500)
    }

    window.addEventListener("offline", goOff)
    window.addEventListener("online", goOn)
    return () => {
      window.removeEventListener("offline", goOff)
      window.removeEventListener("online", goOn)
    }
  }, [])

  if (status === "online") return null

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-xs font-semibold shadow-sm animate-slideUp",
        offsetForDesktopNav ? "top-0 lg:top-16" : "top-0",
        status === "offline" ? "bg-amber-500 text-white" : "bg-green-600 text-white",
      )}
      role="status"
      aria-live="polite"
    >
      {status === "offline" ? (
        <>
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            Hors ligne
            {queueCount > 0 ? ` · ${queueCount} en file` : ""}
          </span>
          {catalogHint && (
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 underline-offset-2 hover:underline"
            >
              <ShoppingBag className="h-3 w-3" />
              Boutique
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 underline-offset-2 hover:underline"
          >
            Feed
          </Link>
          {(draftHint || queueCount > 0) && (
            <Link
              href="/publier"
              className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 underline-offset-2 hover:underline"
            >
              <FilePenLine className="h-3 w-3" />
              Publier
            </Link>
          )}
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5" />
          {queueCount > 0
            ? `Sync… ${queueCount} restante(s)`
            : "Connexion rétablie"}
        </span>
      )}
    </div>
  )
}
