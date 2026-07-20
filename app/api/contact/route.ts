import { NextResponse } from "next/server"
import { sendContactEmail } from "@/lib/email/agentmail"
import { checkRateLimit } from "@/lib/security/rate-limiter"

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit("API_CREATE")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de messages. Réessayez plus tard." },
        { status: 429 },
      )
    }

    const body = await request.json()
    const name = String(body?.name || "").trim()
    const email = String(body?.email || "").trim()
    const subject = String(body?.subject || "").trim()
    const message = String(body?.message || "").trim()

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 },
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const result = await sendContactEmail({ name, email, subject, message })
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Envoi impossible" },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[api/contact]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
