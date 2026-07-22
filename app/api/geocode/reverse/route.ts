import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

type ReverseResult = {
  city: string | null
  country: string | null
  region: string | null
  lat: number
  lon: number
  label: string | null
}

/**
 * Reverse geocode — Nominatim côté serveur (CSP client n'autorise pas OSM).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get("lat"))
  const lon = Number(searchParams.get("lon"))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat/lon requis" }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "coordonnées invalides" }, { status: 400 })
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.searchParams.set("lat", String(lat))
    url.searchParams.set("lon", String(lon))
    url.searchParams.set("format", "json")
    url.searchParams.set("accept-language", "fr")
    url.searchParams.set("zoom", "10")

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "GWA-Platform/1.0 (https://gwa.app; contact@gwa.app)",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Géocodage indisponible", lat, lon } satisfies Partial<ReverseResult> & {
          error: string
        },
        { status: 502 },
      )
    }

    const data = (await res.json()) as {
      display_name?: string
      address?: {
        city?: string
        town?: string
        village?: string
        municipality?: string
        county?: string
        state?: string
        region?: string
        country?: string
      }
    }

    const a = data.address || {}
    const city =
      a.city || a.town || a.village || a.municipality || a.county || a.state || null
    const country = a.country || null
    const region = a.state || a.region || a.county || null

    const payload: ReverseResult = {
      city,
      country,
      region,
      lat,
      lon,
      label: [city, country].filter(Boolean).join(", ") || data.display_name || null,
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.warn("[geocode/reverse]", err)
    return NextResponse.json(
      { error: "Géocodage échoué", lat, lon, city: null, country: null },
      { status: 502 },
    )
  }
}
