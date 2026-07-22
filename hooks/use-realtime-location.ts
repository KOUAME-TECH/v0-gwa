"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type RealtimeLocation = {
  lat: number
  lon: number
  city: string | null
  country: string | null
  region: string | null
  label: string | null
}

export type LocationStatus =
  | "idle"
  | "prompting"
  | "locating"
  | "ready"
  | "denied"
  | "unavailable"
  | "error"

type Options = {
  /** Demander automatiquement au montage */
  auto?: boolean
  /** maximumAge GPS (0 = temps réel) */
  maximumAge?: number
  /** Persister en localStorage */
  persist?: boolean
}

const STORAGE_KEY = "gwa-realtime-location"

function readCache(): RealtimeLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RealtimeLocation
    if (typeof parsed?.lat === "number" && typeof parsed?.lon === "number") return parsed
  } catch {
    /* ignore */
  }
  return null
}

function writeCache(loc: RealtimeLocation) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
  } catch {
    /* ignore */
  }
}

/**
 * Position GPS temps réel + reverse geocode (avec permission navigateur).
 */
export function useRealtimeLocation(options: Options = {}) {
  const { auto = false, maximumAge = 0, persist = true } = options
  const [location, setLocation] = useState<RealtimeLocation | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  const applyLocation = useCallback(
    async (lat: number, lon: number) => {
      setStatus("locating")
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`)
        const data = await res.json()
        const next: RealtimeLocation = {
          lat,
          lon,
          city: data.city ?? null,
          country: data.country ?? null,
          region: data.region ?? null,
          label: data.label ?? null,
        }
        setLocation(next)
        if (persist) writeCache(next)
        setStatus("ready")
        setError(null)
        return next
      } catch {
        const next: RealtimeLocation = {
          lat,
          lon,
          city: null,
          country: null,
          region: null,
          label: "Ma position",
        }
        setLocation(next)
        if (persist) writeCache(next)
        setStatus("ready")
        setError("Ville non résolue — coordonnées OK")
        return next
      }
    },
    [persist],
  )

  const request = useCallback(async (): Promise<RealtimeLocation | null> => {
    if (typeof window === "undefined") return null
    if (!navigator.geolocation) {
      setStatus("unavailable")
      setError("Géolocalisation non supportée")
      return null
    }
    if (busyRef.current) return location
    busyRef.current = true
    setStatus("prompting")
    setError(null)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const next = await applyLocation(pos.coords.latitude, pos.coords.longitude)
            resolve(next)
          } finally {
            busyRef.current = false
          }
        },
        (err) => {
          busyRef.current = false
          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied")
            setError("Autorisez la localisation dans le navigateur")
          } else {
            setStatus("error")
            setError("Position indisponible")
          }
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge,
        },
      )
    })
  }, [applyLocation, location, maximumAge])

  useEffect(() => {
    if (!persist) return
    const cached = readCache()
    if (cached) {
      setLocation(cached)
      setStatus("ready")
    }
  }, [persist])

  useEffect(() => {
    if (!auto) return
    void request()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto once on mount
  }, [auto])

  return {
    location,
    status,
    error,
    request,
    city: location?.city ?? null,
    country: location?.country ?? null,
    label: location?.label ?? null,
  }
}
