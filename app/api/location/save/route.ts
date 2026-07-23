import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/location/save
 * Enregistre la position GPS autorisée sur le profil (auto ou manuel).
 * Body: { lat, lon, city?, country?, region?, address? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const lat = Number(body.lat)
    const lon = Number(body.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "lat/lon requis" }, { status: 400 })
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ error: "coordonnées invalides" }, { status: 400 })
    }

    const city = typeof body.city === "string" ? body.city.trim() || null : null
    const country = typeof body.country === "string" ? body.country.trim() || null : null
    const region = typeof body.region === "string" ? body.region.trim() || null : null
    const address = typeof body.address === "string" ? body.address.trim() || null : null

    const payload: Record<string, unknown> = {
      latitude: lat,
      longitude: lon,
      location_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (city) payload.city = city
    if (country) payload.country = country
    if (address) payload.address = address
    // region n'existe pas forcément sur profiles — city suffit

    let { error } = await supabase.from("profiles").update(payload).eq("id", user.id)

    // Colonnes lat/lon absentes (migration 042 pas encore appliquée) — fallback city/country
    if (error && /latitude|longitude|location_updated_at|column/i.test(error.message)) {
      const fallback: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (city) fallback.city = city
      if (country) fallback.country = country
      if (address) fallback.address = address
      const fb = await supabase.from("profiles").update(fallback).eq("id", user.id)
      error = fb.error
      if (!error) {
        return NextResponse.json({
          success: true,
          degraded: true,
          hint: "Appliquez scripts/schema/042_user_places_link_cooldown.sql pour stocker lat/lon",
          city,
          country,
          region,
        })
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      lat,
      lon,
      city,
      country,
      region,
    })
  } catch (err) {
    console.error("[location/save]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
