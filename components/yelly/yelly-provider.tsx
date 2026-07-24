"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { trackYelly } from "@/lib/yelly/analytics"
import { YellyPanel } from "@/components/yelly/yelly-panel"

type YellyCtx = {
  open: boolean
  openYelly: (source?: string) => void
  closeYelly: () => void
}

const Ctx = createContext<YellyCtx | null>(null)

export function useYelly() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useYelly must be used within YellyProvider")
  return ctx
}

export function useYellyOptional() {
  return useContext(Ctx)
}

function hideYellyChrome(pathname: string) {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dev")
  )
}

/**
 * Provider Yelly — panneau uniquement.
 * Pas de FAB flottant (surcharge l’écran) : entrée via « Aide » dans les headers.
 */
export function YellyProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() || "/"
  const router = useRouter()
  const hidden = hideYellyChrome(pathname)

  const openYelly = useCallback((source = "unknown") => {
    setOpen(true)
    trackYelly("yelly_open", { source })
  }, [])

  const closeYelly = useCallback(() => {
    setOpen(false)
  }, [])

  // PWA / deep-link ?yelly=1 (sans useSearchParams → pas de Suspense obligatoire)
  useEffect(() => {
    if (hidden || typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get("yelly") === "1") {
      openYelly("query_yelly")
      sp.delete("yelly")
      const q = sp.toString()
      router.replace(window.location.pathname + (q ? `?${q}` : ""), { scroll: false })
    }
  }, [hidden, openYelly, router, pathname])

  const value = useMemo(
    () => ({ open, openYelly, closeYelly }),
    [open, openYelly, closeYelly],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {!hidden ? <YellyPanel open={open} onClose={closeYelly} /> : null}
    </Ctx.Provider>
  )
}
