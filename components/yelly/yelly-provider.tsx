"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
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

/** Optional hook — returns null outside provider (nav desktop safe). */
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

export function YellyProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() || "/"
  const hidden = hideYellyChrome(pathname)

  const openYelly = useCallback((source = "unknown") => {
    setOpen(true)
    trackYelly("yelly_open", { source })
  }, [])

  const closeYelly = useCallback(() => {
    setOpen(false)
  }, [])

  const value = useMemo(
    () => ({ open, openYelly, closeYelly }),
    [open, openYelly, closeYelly],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {!hidden ? (
        <>
          <YellyPanel open={open} onClose={closeYelly} />
          <YellyMobileTrigger open={open} onOpen={() => openYelly("mobile_fab")} />
        </>
      ) : null}
    </Ctx.Provider>
  )
}

/**
 * Mobile only — pastille discrète (icône Y, vert GWA).
 * Pas de pastille terracotta ni label « Yelly » flottant.
 * Desktop : entrée « Aide » dans la top nav (voir Navigation).
 */
function YellyMobileTrigger({
  open,
  onOpen,
}: {
  open: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "fixed z-40 flex h-11 w-11 items-center justify-center rounded-full",
        "bg-[#1F5C2E] text-white shadow-md ring-1 ring-black/10",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom)+0.5rem)] right-3",
        "transition active:scale-95 lg:hidden",
        open ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
      aria-label="Aide Yelly"
    >
      <span className="text-sm font-semibold tracking-tight" aria-hidden>
        Y
      </span>
    </button>
  )
}
