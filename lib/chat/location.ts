/** Messages de localisation chat — JSON ou ancien format texte OSM. */

export type ChatLocationPayload = {
  lat: number
  lon: number
  address?: string
  accuracyM?: number
}

export function buildLocationContent(p: ChatLocationPayload): string {
  return JSON.stringify({
    v: 1,
    lat: p.lat,
    lon: p.lon,
    address: p.address || null,
    accuracyM: p.accuracyM ?? null,
  })
}

export function parseLocationContent(content: string): ChatLocationPayload | null {
  const trimmed = (content || "").trim()
  if (!trimmed) return null

  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>
      const lat = Number(j.lat)
      const lon = Number(j.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return {
        lat,
        lon,
        address: typeof j.address === "string" ? j.address : undefined,
        accuracyM:
          j.accuracyM != null && Number.isFinite(Number(j.accuracyM))
            ? Number(j.accuracyM)
            : undefined,
      }
    } catch {
      /* fall through */
    }
  }

  // Ancien format texte avec lien OSM
  const mlat = trimmed.match(/mlat=(-?\d+(?:\.\d+)?)/i)
  const mlon = trimmed.match(/mlon=(-?\d+(?:\.\d+)?)/i)
  if (mlat && mlon) {
    const lat = Number(mlat[1])
    const lon = Number(mlon[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean)
    const address = lines.find(
      (l) => !l.startsWith("📍") && !l.includes("openstreetmap") && !/^-?\d+\.\d+,\s*-?\d+/.test(l),
    )
    return { lat, lon, address }
  }

  const coords = trimmed.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/)
  if (coords) {
    return { lat: Number(coords[1]), lon: Number(coords[2]) }
  }

  return null
}

/** Carte statique OSM (pas de clé API). */
export function staticMapUrl(lat: number, lon: number, w = 280, h = 160): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=16&size=${w}x${h}&maptype=mapnik&markers=${lat},${lon},red-pushpin`
}

export function openStreetMapUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
}

export function isLocationMessage(messageType: string, content: string): boolean {
  if (messageType === "location") return true
  return !!parseLocationContent(content) && /openstreetmap|📍|Ma position/i.test(content)
}
