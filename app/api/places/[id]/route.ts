import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

/** PATCH — renommer / marquer primaire ; DELETE — supprimer un lieu */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.label === "string" && body.label.trim()) {
      patch.label = body.label.trim().slice(0, 120)
    }
    if (typeof body.is_primary === "boolean") {
      patch.is_primary = body.is_primary
    }
    if (typeof body.address === "string") {
      patch.address = body.address.trim() || null
    }

    const { data, error } = await supabase
      .from("user_places")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!data) {
      return NextResponse.json({ error: "Lieu introuvable" }, { status: 404 })
    }

    if (data.is_primary) {
      await supabase
        .from("profiles")
        .update({
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city,
          country: data.country,
          location_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    }

    return NextResponse.json({ success: true, place: data })
  } catch (err) {
    console.error("[places PATCH]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { error } = await supabase
      .from("user_places")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[places DELETE]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
