import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadOwnProfile } from "@/lib/profile/self"

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

    const profile = await loadOwnProfile<{
      id: string
      email?: string | null
      linked_email?: string | null
      full_name?: string | null
      phone?: string | null
      phone_verified?: boolean | null
      scg_score?: number | null
    }>(supabase)

    if (!profile) {
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
