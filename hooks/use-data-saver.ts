"use client"

import { useCallback, useEffect, useState } from "react"
import {
  allowAutoplayFor,
  DATA_SAVER_KEY,
  imageQualityFor,
  serializeDataSaver,
  shouldAutoEnableDataSaver,
} from "@/lib/data-saver"

type NetworkInformationLike = {
  saveData?: boolean
}

/**
 * Mode bas débit — qualité images réduite, pas d'autoplay.
 * Persiste dans localStorage (`gwa_data_saver`).
 * Auto-active si `navigator.connection.saveData` et aucune préférence stockée.
 */
export function useDataSaver() {
  const [enabled, setEnabled] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DATA_SAVER_KEY)
      const connection = (navigator as Navigator & {
        connection?: NetworkInformationLike
      }).connection
      const next = shouldAutoEnableDataSaver(stored, connection?.saveData)
      setEnabled(next)
      if (stored == null && next) {
        localStorage.setItem(DATA_SAVER_KEY, "1")
      }
    } catch {
      /* private mode / SSR */
    }
    setHydrated(true)
  }, [])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(DATA_SAVER_KEY, serializeDataSaver(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const setEnabledPersist = useCallback((on: boolean) => {
    setEnabled(on)
    try {
      localStorage.setItem(DATA_SAVER_KEY, serializeDataSaver(on))
    } catch {
      /* ignore */
    }
  }, [])

  const active = hydrated && enabled

  return {
    enabled: active,
    hydrated,
    toggle,
    setEnabled: setEnabledPersist,
    imageQuality: imageQualityFor(active),
    allowAutoplay: allowAutoplayFor(active),
  }
}
