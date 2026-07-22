import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PLACE_TYPES, type PlaceType } from "@/lib/location/places"

const PLACE_TYPE_SET = new Set<string>(PLACE_TYPES.map((p) => p.value))

/**
 * GET /api/places — lieux fixés de l'utilisateur
 * POST /api/places — fixer un lieu capté (champ, entrepôt…)
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_places")
      .select("*")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      if (/relation|does not exist|user_places/i.test(error.message)) {
        return NextResponse.json({
          places: [],
          migrationRequired: true,
          hint: "Appliquez scripts/schema/042_user_places_link_cooldown.sql",
        })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ places: data || [] })
  } catch (err) {
    console.error("[places GET]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

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
    const placeType = String(body.place_type || "autre") as PlaceType
    if (!PLACE_TYPE_SET.has(placeType)) {
      return NextResponse.json({ error: "Type de lieu invalide" }, { status: 400 })
    }

    const lat = Number(body.lat)
    const lon = Number(body.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Position GPS requise" }, { status: 400 })
    }

    const label =
      (typeof body.label === "string" && body.label.trim()) ||
      PLACE_TYPES.find((p) => p.value === placeType)?.label ||
      "Lieu"

    const row = {
      user_id: user.id,
      place_type: placeType,
      label: label.slice(0, 120),
      latitude: lat,
      longitude: lon,
      city: typeof body.city === "string" ? body.city.trim() || null : null,
      country: typeof body.country === "string" ? body.country.trim() || null : null,
      region: typeof body.region === "string" ? body.region.trim() || null : null,
      address: typeof body.address === "string" ? body.address.trim() || null : null,
      is_primary: body.is_primary === true,
    }

    const { data, error } = await supabase.from("user_places").insert(row).select("*").single()

    if (error) {
      if (/relation|does not exist|user_places/i.test(error.message)) {
        return NextResponse.json(
          {
            error: "Table lieux absente — appliquez la migration 042",
            code: "MIGRATION_REQUIRED",
          },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Sync profil si primaire
    if (row.is_primary) {
      await supabase
        .from("profiles")
        .update({
          latitude: lat,
          longitude: lon,
          city: row.city,
          country: row.country,
          location_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    }

    return NextResponse.json({ success: true, place: data })
  } catch (err) {
    console.error("[places POST]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
