import { NextResponse } from "next/server"
import { sendContactEmail } from "@/lib/email/agentmail"
import { assertSameOrigin } from "@/lib/security/csrf"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { sanitizePlainText } from "@/lib/security/validation"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/contact
 * Enregistre le message en base (inbox support) + email AgentMail si configuré.
 */
export async function POST(request: Request) {
  try {
    const csrf = assertSameOrigin(request)
    if (csrf) return csrf

    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de messages. Réessayez plus tard." },
        { status: 429 },
      )
    }

    const body = await request.json()
    const name = sanitizePlainText(String(body?.name || ""), 100)
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 255)
    const subject = sanitizePlainText(String(body?.subject || ""), 200)
    const message = sanitizePlainText(String(body?.message || ""), 4000)

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 },
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    let userId: string | null = null
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch {
      /* anonyme OK */
    }

    // Persister pour le back-office support
    let stored = false
    let storeError: string | null = null
    try {
      const admin = createAdminClient()
      const { error } = await admin.from("contact_messages").insert({
        name,
        email,
        subject,
        message,
        user_id: userId,
        status: "open",
      })
      if (error) {
        storeError = error.message
        console.warn("[api/contact] store", error.message)
      } else {
        stored = true
      }
    } catch (err) {
      storeError = err instanceof Error ? err.message : "store failed"
      console.warn("[api/contact] store", storeError)
    }

    const result = await sendContactEmail({ name, email, subject, message })

    // Succès si stocké OU email envoyé (au moins un canal)
    if (!stored && !result.success) {
      return NextResponse.json(
        {
          error:
            result.error ||
            storeError ||
            "Envoi impossible. Écrivez-nous sur WhatsApp.",
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      stored,
      emailed: result.success,
      migrationHint: stored
        ? undefined
        : "Appliquez scripts/schema/043_contact_messages.sql pour l'inbox support",
    })
  } catch (err) {
    console.error("[api/contact]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
