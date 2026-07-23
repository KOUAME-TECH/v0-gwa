import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

type ReverseResult = {
  city: string | null
  country: string | null
  region: string | null
  address: string | null
  road: string | null
  suburb: string | null
  postcode: string | null
  lat: number
  lon: number
  label: string | null
  display_name: string | null
}

/**
 * Reverse geocode précis (Nominatim, zoom bâtiment/rue).
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
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("accept-language", "fr")
    // 18 = niveau adresse/bâtiment (plus précis que ville)
    url.searchParams.set("zoom", "18")
    url.searchParams.set("addressdetails", "1")

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
        { error: "Géocodage indisponible", lat, lon },
        { status: 502 },
      )
    }

    const data = (await res.json()) as {
      display_name?: string
      address?: {
        house_number?: string
        road?: string
        pedestrian?: string
        path?: string
        neighbourhood?: string
        suburb?: string
        quarter?: string
        city?: string
        town?: string
        village?: string
        municipality?: string
        county?: string
        state?: string
        region?: string
        postcode?: string
        country?: string
      }
    }

    const a = data.address || {}
    const city =
      a.city || a.town || a.village || a.municipality || a.county || a.state || null
    const country = a.country || null
    const region = a.state || a.region || a.county || null
    const road = a.road || a.pedestrian || a.path || null
    const suburb = a.suburb || a.neighbourhood || a.quarter || null
    const postcode = a.postcode || null

    const streetLine = [a.house_number, road].filter(Boolean).join(" ")
    const addressParts = [streetLine || null, suburb, city, postcode, country].filter(
      Boolean,
    ) as string[]
    const address =
      addressParts.length > 0
        ? addressParts.join(", ")
        : data.display_name || null

    const payload: ReverseResult = {
      city,
      country,
      region,
      address,
      road: road || null,
      suburb: suburb || null,
      postcode,
      lat,
      lon,
      label: address || [city, country].filter(Boolean).join(", ") || null,
      display_name: data.display_name || null,
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
