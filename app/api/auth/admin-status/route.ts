import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"

/** Statut admin fiable (service role) — évite les échecs RLS côté client */
export async function GET() {
  try {
    const gate = await requireAdmin()

    // Invité / non authentifié : 200 + isAdmin false (évite bruit console 401 sur pages publiques)
    if (!gate.user) {
      return NextResponse.json({ isAdmin: false, role: null })
    }

    if (!gate.isAdmin) {
      return NextResponse.json({ isAdmin: false, role: null })
    }

    return NextResponse.json({
      isAdmin: true,
      role: gate.role.role,
      userId: gate.user.id,
    })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
