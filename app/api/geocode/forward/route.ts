import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Forward geocode — adresse/ville → lat/lon (pour carte livraison commande).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  if (q.length < 2) {
    return NextResponse.json({ error: "q requis" }, { status: 400 })
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", q)
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("limit", "1")
    url.searchParams.set("addressdetails", "1")
    url.searchParams.set("accept-language", "fr")

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "GWA-Platform/1.0 (https://mygwa.org; contact@mygwa.org)",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Géocodage indisponible" }, { status: 502 })
    }

    const rows = (await res.json()) as Array<{
      lat?: string
      lon?: string
      display_name?: string
      address?: {
        city?: string
        town?: string
        village?: string
        country?: string
        road?: string
        suburb?: string
      }
    }>

    const hit = rows[0]
    if (!hit?.lat || !hit?.lon) {
      return NextResponse.json({ error: "Adresse introuvable" }, { status: 404 })
    }

    const a = hit.address || {}
    const city = a.city || a.town || a.village || null
    const address = hit.display_name || q

    return NextResponse.json({
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      address,
      city,
      country: a.country || null,
      road: a.road || null,
      suburb: a.suburb || null,
      label: address,
    })
  } catch (err) {
    console.warn("[geocode/forward]", err)
    return NextResponse.json({ error: "Géocodage échoué" }, { status: 502 })
  }
}
