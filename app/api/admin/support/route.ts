import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/require-admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { canAccessSection } from "@/lib/auth/admin-permissions"

/**
 * GET /api/admin/support — inbox Aide & Contact
 */
export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 })
    }

    const gate = await requireAdmin()
    if (!gate.isAdmin || !gate.admin || !gate.role) {
      return NextResponse.json(
        { error: gate.error || "Accès refusé" },
        { status: gate.user ? 403 : 401 },
      )
    }

    if (!canAccessSection(gate.role.role, "support")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const status = request.nextUrl.searchParams.get("status") || "open"

    let query = gate.admin
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query
    if (error) {
      const migration =
        /relation|does not exist|contact_messages/i.test(error.message)
      return NextResponse.json(
        {
          error: error.message,
          migrationRequired: migration,
          hint: migration
            ? "Appliquez scripts/schema/043_contact_messages.sql"
            : undefined,
          messages: [],
        },
        { status: migration ? 200 : 400 },
      )
    }

    return NextResponse.json({ messages: data || [] })
  } catch (err) {
    console.error("[api/admin/support]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
