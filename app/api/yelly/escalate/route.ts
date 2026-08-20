import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizePlainText } from "@/lib/security/validation"
import { isSupportQuietHours, quietHoursMessage } from "@/lib/yelly/quiet-hours"

export const dynamic = "force-dynamic"

/**
 * POST /api/yelly/escalate — crée un ticket support depuis Yelly.
 */
export async function POST(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json({ error: "Trop de demandes" }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Escalade = ticket support — réservé aux comptes connectés (anti-spam anonyme).
    if (!user) {
      return NextResponse.json(
        {
          error: "Connecte-toi pour parler à quelqu’un, ou WhatsApp +225 07 88 32 60 19.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const summary = sanitizePlainText(String(body?.summary || ""), 3500)
    const page = sanitizePlainText(String(body?.page || ""), 120)

    if (!summary || summary.length < 8) {
      return NextResponse.json({ error: "Résumé trop court" }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()
    const name = profile?.full_name || "Utilisateur GWA"
    const email = profile?.email || user.email || "user@gwa.local"

    const admin = createAdminClient()
    const { error } = await admin.from("contact_messages").insert({
      name: sanitizePlainText(name, 100),
      email: email.slice(0, 255),
      subject: `Yelly → agent (${page || "app"})`,
      message: summary,
      user_id: user.id,
      status: "open",
    })

    if (error) {
      console.error("[yelly/escalate]", error.message)
      return NextResponse.json(
        { error: "Ticket impossible. WhatsApp +225 07 88 32 60 19." },
        { status: 502 },
      )
    }

    const quiet = isSupportQuietHours()
    return NextResponse.json({
      ok: true,
      quietHours: quiet,
      message: quiet ? quietHoursMessage() : undefined,
    })
  } catch (err) {
    console.error("[api/yelly/escalate]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
