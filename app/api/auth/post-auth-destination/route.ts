import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth"

/** Destination post-login (double identité admin + compte métier). */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const { path, isNewUser } = await resolvePostAuthRedirect(supabase, user.id)
    return NextResponse.json({ path, isNewUser })
  } catch (err) {
    console.error("[api/auth/post-auth-destination]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
