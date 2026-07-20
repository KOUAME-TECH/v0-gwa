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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, linked_email, full_name, phone, phone_verified, user_type, sub_type, country, city, address, avatar_url, bio, is_verified, rating, total_reviews, auth_method, preferred_language, profile_completion_pct, onboarding_completed_at, scg_score, scg_badge, scg_bancable, scg_calculated_at, created_at, updated_at",
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
            email: profile.linked_email || profile.email || user.email || null,
            phone: profile.phone || user.phone || null,
          }
        : null,
      scg_score: profile?.scg_score ?? 0,
      identity: {
        auth_phone: user.phone || null,
        auth_email: user.email || null,
        linked: !!(profile?.phone && (profile?.linked_email || profile?.email || user.email)),
      },
    })
  } catch (err) {
    console.error("[auth/me]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
