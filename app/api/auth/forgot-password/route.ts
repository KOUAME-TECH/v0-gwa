import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/security/rate-limiter"

/**
 * POST /api/auth/forgot-password
 *
 * Rate-limité (PASSWORD_RESET) + anti-énumération :
 * réponse succès identique que le compte existe ou non.
 */
function safeOrigin(request: Request): string {
  const origin = request.headers.get("origin")
  if (origin) {
    try {
      const u = new URL(origin)
      if (u.protocol === "https:" || u.hostname === "localhost") {
        return u.origin
      }
    } catch {
      /* fall through */
    }
  }
  return new URL(request.url).origin
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : ""

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const rateLimit = await checkRateLimit("PASSWORD_RESET", email)
    if (!rateLimit.success) {
      const waitMin = Math.ceil((rateLimit.resetAt - Date.now()) / 60000)
      return NextResponse.json(
        {
          error: `Trop de demandes. Réessayez dans ${Math.max(1, waitMin)} min.`,
          retry_after: Math.max(
            0,
            Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          ),
        },
        { status: 429 },
      )
    }

    const origin = safeOrigin(request)
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`

    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      // Log ops uniquement — client reçoit toujours le même message.
      console.error("[auth/forgot-password]", error.message.slice(0, 120))
    }

    return NextResponse.json({
      success: true,
      message:
        "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.",
    })
  } catch (err) {
    console.error("[auth/forgot-password]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
