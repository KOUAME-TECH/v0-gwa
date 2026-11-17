import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // This endpoint is consumed by the factoring UI, which needs only public
    // profile attributes and SCG fields. Never request restricted PII here.
    const { data: profile, error: profileError } = await supabase
      .from("profiles_public")
      .select(
        "id, full_name, user_type, sub_type, country, city, avatar_url, bio, is_verified, rating, total_reviews, profile_completion_pct, scg_score, scg_badge, scg_bancable, created_at",
      )
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("[auth/me]", profileError.message)
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })
    }

    return NextResponse.json({
      profile: profile
        ? {
            ...profile,
            email: user.email || null,
            phone: user.phone || null,
          }
        : null,
      scg_score: profile?.scg_score ?? 0,
      identity: {
        auth_phone: user.phone || null,
        auth_email: user.email || null,
        linked: Boolean(user.phone && user.email),
      },
    })
  } catch (err) {
    console.error("[auth/me]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
