import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { destinationForProfile } from "@/lib/auth/post-auth"
import { assertSameOrigin } from "@/lib/security/csrf"

const ROLES = {
  producteur: { user_type: "producteur", sub_type: "producteur_individuel" },
  acheteur: { user_type: "acheteur", sub_type: null },
  cooperative: { user_type: "cooperative", sub_type: "cooperative" },
} as const

/**
 * Choix unique du rôle, tant que le compte n'en a pas.
 * Le trigger SQL bloque cette écriture depuis le navigateur.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request)
  if (csrf) return csrf

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const role = body && typeof body.role === "string" ? body.role : ""
  const choice = ROLES[role as keyof typeof ROLES]
  if (!choice) {
    return NextResponse.json({ error: "Choix invalide" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("user_type, full_name")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.user_type) {
    const dest = destinationForProfile({
      userType: profile.user_type,
      fullName: profile.full_name,
    })
    return NextResponse.json({ path: dest.path, already_set: true })
  }

  const { error } = await admin
    .from("profiles")
    .update({
      user_type: choice.user_type,
      sub_type: choice.sub_type,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    console.error("[auth/choose-role]", error.message)
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 400 })
  }

  const dest = destinationForProfile({
    userType: choice.user_type,
    fullName: profile?.full_name || user.user_metadata?.full_name || " ",
  })
  return NextResponse.json({ path: dest.path, already_set: false })
}
