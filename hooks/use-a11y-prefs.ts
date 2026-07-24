"use client"

import { useCallback, useEffect, useState } from "react"

const LARGE_TEXT_KEY = "gwa_large_text"
const QUIET_HOURS_KEY = "gwa_quiet_hours"

/** Préférences locales accessibilité / silence (sans migration DB). */
export function useA11yPrefs() {
  const [largeText, setLargeTextState] = useState(false)
  const [quietHours, setQuietHoursState] = useState(false)

  useEffect(() => {
    try {
      const lt = localStorage.getItem(LARGE_TEXT_KEY) === "1"
      const qh = localStorage.getItem(QUIET_HOURS_KEY) === "1"
      setLargeTextState(lt)
      setQuietHoursState(qh)
      document.documentElement.classList.toggle("gwa-large-text", lt)
    } catch {
      /* private mode */
    }
  }, [])

  const setLargeText = useCallback((on: boolean) => {
    setLargeTextState(on)
    try {
      localStorage.setItem(LARGE_TEXT_KEY, on ? "1" : "0")
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("gwa-large-text", on)
  }, [])

  const setQuietHours = useCallback((on: boolean) => {
    setQuietHoursState(on)
    try {
      localStorage.setItem(QUIET_HOURS_KEY, on ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [])

  return { largeText, setLargeText, quietHours, setQuietHours }
}

/** Quiet hours notifs client : 22h–6h Abidjan (UTC+0 approx. Côte d’Ivoire). */
export function isQuietHoursNow(enabled: boolean, now = new Date()): boolean {
  if (!enabled) return false
  const h = now.getUTCHours()
  return h >= 22 || h < 6
}
