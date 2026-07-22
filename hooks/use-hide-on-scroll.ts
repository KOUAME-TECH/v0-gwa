"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Masque la bottom nav au scroll bas, réaffiche au scroll haut.
 * Écoute window + capture (conteneurs overflow) — toutes pages shell.
 */
export function useHideOnScroll(enabled = true, threshold = 6) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const ticking = useRef(false)
  const pathname = usePathname()

  // Reset à chaque navigation
  useEffect(() => {
    setHidden(false)
    lastY.current = typeof window !== "undefined" ? window.scrollY || 0 : 0
  }, [pathname])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setHidden(false)
      return
    }

    lastY.current = window.scrollY || 0

    const readY = (target: EventTarget | null): number => {
      if (target && target instanceof Element) {
        if (target === document.documentElement || target === document.body) {
          return window.scrollY || document.documentElement.scrollTop || 0
        }
        const style = window.getComputedStyle(target)
        const canScroll =
          /(auto|scroll|overlay)/.test(style.overflowY) ||
          /(auto|scroll|overlay)/.test(style.overflow)
        if (canScroll && target.scrollHeight > target.clientHeight + 8) {
          return target.scrollTop
        }
      }
      return window.scrollY || document.documentElement.scrollTop || 0
    }

    const onScroll = (e: Event) => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = readY(e.target)
        const delta = y - lastY.current
        if (Math.abs(delta) >= threshold) {
          if (delta > 0 && y > 40) setHidden(true)
          else if (delta < 0) setHidden(false)
          lastY.current = y
        }
        if (y < 16) setHidden(false)
        ticking.current = false
      })
    }

    // capture:true → catch scroll dans overflow-y-auto enfants
    window.addEventListener("scroll", onScroll, { passive: true, capture: true })
    document.addEventListener("scroll", onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      document.removeEventListener("scroll", onScroll, true)
    }
  }, [enabled, threshold])

  return hidden
}
