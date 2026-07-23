"use client"

import { useCallback, useEffect, useState } from "react"
import { MapPin, Plus, Star, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { PLACE_TYPES, placeTypeLabel, type PlaceType, type UserPlace } from "@/lib/location/places"
import { formatCoords, type RealtimeLocation } from "@/hooks/use-realtime-location"
import { LocationMapCard } from "@/components/location/location-map-card"

type Props = {
  location: RealtimeLocation | null
  onRequestLocation: () => Promise<RealtimeLocation | null>
  locating?: boolean
}

/**
 * Lieux fixés à partir de la position captée (champ, entrepôt, marché…).
 */
export function PlacesManager({ location, onRequestLocation, locating }: Props) {
  const [places, setPlaces] = useState<UserPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [placeType, setPlaceType] = useState<PlaceType>("champ")
  const [label, setLabel] = useState("")

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/places")
      const data = await res.json().catch(() => ({}))
      setPlaces(Array.isArray(data.places) ? data.places : [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pinCurrent = async (asPrimary = false) => {
    setSaving(true)
    try {
      let loc = location
      if (!loc) {
        loc = await onRequestLocation()
      }
      if (!loc) {
        toast.error("Autorisez la localisation pour fixer ce lieu")
        return
      }

      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_type: placeType,
          label: label.trim() || placeTypeLabel(placeType),
          lat: loc.lat,
          lon: loc.lon,
          city: loc.city,
          country: loc.country,
          region: loc.region,
          is_primary: asPrimary,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Impossible d'enregistrer ce lieu.")
        return
      }
      setLabel("")
      toast.success("Lieu enregistré")
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  const setPrimary = async (id: string) => {
    const res = await fetch(`/api/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_primary: true }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Impossible de définir le lieu principal.")
      return
    }
    toast.success("Lieu principal mis à jour")
    await refresh()
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/places/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Impossible de supprimer ce lieu.")
      return
    }
    toast.success("Lieu supprimé")
    await refresh()
  }

  return (
    <div className="bg-white rounded-2xl p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-[#111827]">Mes lieux</h2>
        {location && (
          <p className="text-[11px] font-mono text-[#9CA3AF] mt-1.5 tabular-nums">
            {formatCoords(location.lat, location.lon, location.accuracy)}
          </p>
        )}
      </div>

      {location && (
        <LocationMapCard
          lat={location.lat}
          lon={location.lon}
          accuracy={location.accuracy}
          altitude={location.altitude}
          address={location.address}
          city={location.city}
          country={location.country}
          label={location.label}
          height={180}
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {PLACE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setPlaceType(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              placeType === t.value
                ? "bg-[#2F7D32] text-white"
                : "bg-[#FFF6E5] text-[#4B5563]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nom du lieu"
        className="h-11 rounded-xl border-[#E5E7EB] bg-[#FFF6E5]/50"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-10 rounded-xl bg-[#2F7D32] hover:bg-[#256025]"
          disabled={saving || locating}
          onClick={() => void pinCurrent(places.length === 0)}
        >
          {saving || locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1.5" />
              Enregistrer ici
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="h-8 flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
        </div>
      ) : places.length === 0 ? (
        <p className="text-xs text-[#9CA3AF]">Aucun lieu pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {places.map((p) => (
            <li
              key={p.id}
              className="flex items-start gap-2 rounded-xl border border-[#E5E7EB] px-3 py-2.5"
            >
              <MapPin className="h-4 w-4 text-[#2F7D32] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111827] truncate">
                  {p.label}
                  {p.is_primary && (
                    <span className="ml-1.5 text-[10px] text-[#2F7D32] font-semibold">
                      Principal
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  {placeTypeLabel(p.place_type)}
                  {p.city ? ` · ${p.city}` : ""}
                  {p.country ? `, ${p.country}` : ""}
                </p>
                {p.latitude != null && p.longitude != null && (
                  <p className="text-[10px] font-mono text-[#9CA3AF] tabular-nums mt-0.5">
                    {Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}
                  </p>
                )}
              </div>
              {!p.is_primary && (
                <button
                  type="button"
                  className="p-1.5 text-[#F39A1F] active:opacity-60"
                  aria-label="Définir comme principal"
                  onClick={() => void setPrimary(p.id)}
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                className="p-1.5 text-red-500 active:opacity-60"
                aria-label="Supprimer"
                onClick={() => void remove(p.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
