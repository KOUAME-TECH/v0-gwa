"use client"

import { useCallback, useEffect, useState } from "react"

const LARGE_TEXT_KEY = "gwa_large_text"
const QUIET_HOURS_KEY = "gwa_quiet_hours"
const REDUCE_MOTION_KEY = "gwa_reduce_motion"

/** Préférences locales accessibilité / silence (sans migration DB). */
export function useA11yPrefs() {
  const [largeText, setLargeTextState] = useState(false)
  const [quietHours, setQuietHoursState] = useState(false)
  const [reduceMotion, setReduceMotionState] = useState(false)

  useEffect(() => {
    try {
      const lt = localStorage.getItem(LARGE_TEXT_KEY) === "1"
      const qh = localStorage.getItem(QUIET_HOURS_KEY) === "1"
      const osReduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      const rm =
        localStorage.getItem(REDUCE_MOTION_KEY) === "1" ||
        (localStorage.getItem(REDUCE_MOTION_KEY) == null && osReduce)
      setLargeTextState(lt)
      setQuietHoursState(qh)
      setReduceMotionState(rm)
      document.documentElement.classList.toggle("gwa-large-text", lt)
      document.documentElement.classList.toggle("gwa-reduce-motion", rm)
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

  const setReduceMotion = useCallback((on: boolean) => {
    setReduceMotionState(on)
    try {
      localStorage.setItem(REDUCE_MOTION_KEY, on ? "1" : "0")
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("gwa-reduce-motion", on)
  }, [])

  return {
    largeText,
    setLargeText,
    quietHours,
    setQuietHours,
    reduceMotion,
    setReduceMotion,
  }
}

/** Quiet hours notifs client : 22h–6h Abidjan (UTC+0 approx. Côte d’Ivoire). */
export function isQuietHoursNow(enabled: boolean, now = new Date()): boolean {
  if (!enabled) return false
  const h = now.getUTCHours()
  return h >= 22 || h < 6
}
