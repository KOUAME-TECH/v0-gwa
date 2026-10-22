"use client"

import { ExternalLink, MapPin, Navigation } from "lucide-react"
import { formatCoords } from "@/hooks/use-realtime-location"

type Props = {
  lat: number
  lon: number
  accuracy?: number | null
  altitude?: number | null
  address?: string | null
  city?: string | null
  country?: string | null
  label?: string | null
  className?: string
  /** Hauteur de la carte */
  height?: number
}

function osmEmbedUrl(lat: number, lon: number, delta = 0.008) {
  const left = lon - delta
  const right = lon + delta
  const top = lat + delta
  const bottom = lat - delta
  const bbox = `${left}%2C${bottom}%2C${right}%2C${top}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`
}

function osmOpenUrl(lat: number, lon: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
}

function staticMapUrl(lat: number, lon: number) {
  // Aperçu image (fallback si iframe bloquée)
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=16&size=640x320&maptype=mapnik&markers=${lat},${lon},red-pushpin`
}

/**
 * Aperçu carte type Maps : iframe OSM + adresse + coordonnées précises.
 */
export function LocationMapCard({
  lat,
  lon,
  accuracy,
  altitude,
  address,
  city,
  country,
  label,
  className = "",
  height = 200,
}: Props) {
  const title = address || label || [city, country].filter(Boolean).join(", ") || "Ma position"
  const placeLine = [city, country].filter(Boolean).join(", ")
  const openUrl = osmOpenUrl(lat, lon)
  const embedUrl = osmEmbedUrl(lat, lon)
  const imgUrl = staticMapUrl(lat, lon)

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white ${className}`}
    >
      <div className="relative w-full bg-[#E8F0E9]" style={{ height }}>
        <iframe
          title="Carte de votre position"
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {/* Fallback image sous l'iframe (si iframe vide / lente) */}
        { }
        <img
          src={imgUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = "none"
          }}
          onLoad={(e) => {
            // Si l'iframe ne charge pas, on pourrait basculer — on garde l'iframe prioritaire
            void e
          }}
        />
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#1F5C2E] shadow-sm">
          <Navigation className="h-3 w-3" />
          GPS
          {accuracy != null && Number.isFinite(accuracy)
            ? ` ±${Math.round(accuracy)} m`
            : ""}
        </div>
      </div>

      <div className="space-y-1.5 px-3 py-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2F7D32]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-[#111827]">{title}</p>
            {placeLine && placeLine !== title && (
              <p className="text-xs text-[#4B5563] mt-0.5">{placeLine}</p>
            )}
            <p className="mt-1 text-[11px] font-mono tabular-nums text-[#6B7280] break-all">
              {formatCoords(lat, lon, accuracy)}
              {altitude != null && Number.isFinite(altitude)
                ? ` · alt. ${Math.round(altitude)} m`
                : ""}
            </p>
          </div>
        </div>
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2F7D32] active:opacity-70"
        >
          Ouvrir la carte
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
