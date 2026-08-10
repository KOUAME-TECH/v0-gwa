<<<<<<< Updated upstream
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
=======
/**
 * GET /api/auth/me
 * Retourne le profil complet + score SCG de l'utilisateur connecté
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
>>>>>>> Stashed changes

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
<<<<<<< Updated upstream
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
=======
      .select("*")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })
    }

    // Score SCG le plus récent
    const { data: scgScore } = await supabase
      .from("scg_scores")
      .select("score_total, badge, bancable, dim_fiabilite, dim_qualite, dim_engagement, dim_volumes, dim_stabilite")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      profile,
      scg_score: scgScore?.score_total ?? 0,
      scg_badge: scgScore?.badge ?? "insuffisant",
      scg_bancable: scgScore?.bancable ?? false,
    })
  } catch (err) {
    console.error("[GWA] auth/me error:", err)
>>>>>>> Stashed changes
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
