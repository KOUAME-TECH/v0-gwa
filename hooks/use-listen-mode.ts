"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "gwa-listen-mode"

/** Préférence « Mode écoute » — met en avant les contrôles audio (rétention + inclusion). */
export function useListenMode() {
  const [enabled, setEnabled] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      /* SSR / private mode */
    }
    setHydrated(true)
  }, [])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { enabled: hydrated && enabled, toggle, hydrated }
}
