"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Masque la bottom nav au scroll vers le bas, la réaffiche au scroll vers le haut.
 * Style dynamique type apps natives (PR8-compatible).
 */
export function useHideOnScroll(enabled = true, threshold = 8) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setHidden(false)
      return
    }

    lastY.current = window.scrollY || 0

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY || 0
        const delta = y - lastY.current
        if (Math.abs(delta) >= threshold) {
          if (delta > 0 && y > 48) setHidden(true)
          else if (delta < 0) setHidden(false)
          lastY.current = y
        }
        if (y < 24) setHidden(false)
        ticking.current = false
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [enabled, threshold])

  return hidden
}
