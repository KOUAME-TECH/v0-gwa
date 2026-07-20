import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("[auth/logout]", error.message)
      return NextResponse.json({ error: "Déconnexion impossible" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[auth/logout]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
