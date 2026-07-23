"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type RealtimeLocation = {
  lat: number
  lon: number
  /** Précision GPS en mètres (si dispo) */
  accuracy: number | null
  altitude: number | null
  city: string | null
  country: string | null
  region: string | null
  /** Adresse complète (rue, quartier…) */
  address: string | null
  road: string | null
  suburb: string | null
  postcode: string | null
  label: string | null
  displayName: string | null
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
  /** maximumAge GPS (0 = frais) */
  maximumAge?: number
  /** Persister en localStorage */
  persist?: boolean
  /** Suivre la position en continu (watchPosition) */
  watch?: boolean
}

const STORAGE_KEY = "gwa-realtime-location"

function readCache(): RealtimeLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RealtimeLocation>
    if (typeof parsed?.lat === "number" && typeof parsed?.lon === "number") {
      return {
        lat: parsed.lat,
        lon: parsed.lon,
        accuracy: parsed.accuracy ?? null,
        altitude: parsed.altitude ?? null,
        city: parsed.city ?? null,
        country: parsed.country ?? null,
        region: parsed.region ?? null,
        address: parsed.address ?? null,
        road: parsed.road ?? null,
        suburb: parsed.suburb ?? null,
        postcode: parsed.postcode ?? null,
        label: parsed.label ?? null,
        displayName: parsed.displayName ?? null,
      }
    }
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

export function formatCoords(lat: number, lon: number, accuracy?: number | null) {
  const base = `${lat.toFixed(6)}, ${lon.toFixed(6)}`
  if (accuracy != null && Number.isFinite(accuracy)) {
    return `${base} (±${Math.round(accuracy)} m)`
  }
  return base
}

/**
 * Position GPS haute précision + reverse geocode (adresse complète).
 */
export function useRealtimeLocation(options: Options = {}) {
  const {
    auto = false,
    maximumAge = 0,
    persist = true,
    watch = false,
  } = options
  const [location, setLocation] = useState<RealtimeLocation | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)
  const watchIdRef = useRef<number | null>(null)

  const applyLocation = useCallback(
    async (
      lat: number,
      lon: number,
      accuracy: number | null = null,
      altitude: number | null = null,
    ) => {
      setStatus("locating")
      try {
        const res = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
        )
        const data = await res.json().catch(() => ({}))
        const next: RealtimeLocation = {
          lat,
          lon,
          accuracy,
          altitude,
          city: data.city ?? null,
          country: data.country ?? null,
          region: data.region ?? null,
          address: data.address ?? null,
          road: data.road ?? null,
          suburb: data.suburb ?? null,
          postcode: data.postcode ?? null,
          label: data.label ?? data.address ?? null,
          displayName: data.display_name ?? null,
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
          accuracy,
          altitude,
          city: null,
          country: null,
          region: null,
          address: null,
          road: null,
          suburb: null,
          postcode: null,
          label: formatCoords(lat, lon, accuracy),
          displayName: null,
        }
        setLocation(next)
        if (persist) writeCache(next)
        setStatus("ready")
        setError("Adresse non trouvée, coordonnées OK")
        return next
      }
    },
    [persist],
  )

  const request = useCallback(async (): Promise<RealtimeLocation | null> => {
    if (typeof window === "undefined") return null
    if (!navigator.geolocation) {
      setStatus("unavailable")
      setError("Localisation indisponible sur cet appareil")
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
            const next = await applyLocation(
              pos.coords.latitude,
              pos.coords.longitude,
              Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
              pos.coords.altitude != null && Number.isFinite(pos.coords.altitude)
                ? pos.coords.altitude
                : null,
            )
            resolve(next)
          } finally {
            busyRef.current = false
          }
        },
        (err) => {
          busyRef.current = false
          if (err.code === err.PERMISSION_DENIED) {
            setStatus("denied")
            setError("Autorisez la localisation pour continuer")
          } else {
            setStatus("error")
            setError("Position introuvable. Réessayez dehors ou près d'une fenêtre.")
          }
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 20_000,
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

  useEffect(() => {
    if (!watch || typeof window === "undefined" || !navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void applyLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          pos.coords.altitude != null && Number.isFinite(pos.coords.altitude)
            ? pos.coords.altitude
            : null,
        )
      },
      () => {
        /* keep last good fix */
      },
      {
        enableHighAccuracy: true,
        maximumAge,
        timeout: 20_000,
      },
    )
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [watch, maximumAge, applyLocation])

  return {
    location,
    status,
    error,
    request,
    city: location?.city ?? null,
    country: location?.country ?? null,
    address: location?.address ?? null,
    label: location?.label ?? null,
    coordsLabel: location
      ? formatCoords(location.lat, location.lon, location.accuracy)
      : null,
  }
}
