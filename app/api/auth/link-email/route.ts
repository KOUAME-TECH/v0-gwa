import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { formatPhoneE164, validateWestAfricaPhone } from "@/lib/auth/phone"

/**
 * POST /api/auth/link-email
 * Lie un email au compte déjà authentifié par téléphone (ou inverse).
 * Body: { email: string } — optionnel phone si on veut aussi synchroniser
 *
 * Règle GWA Afrique-first :
 * - Le téléphone profil est la clé d'identité terrain
 * - L'email est rattaché au même compte auth (updateUser)
 * - Stocké aussi dans profiles.linked_email + profiles.email
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : null
    const countryCode = body.countryCode || "ci"

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, email, linked_email")
      .eq("id", user.id)
      .maybeSingle()

    const profilePhone = profile?.phone || user.phone || null
    if (!profilePhone && !phoneRaw) {
      return NextResponse.json(
        {
          error:
            "Ajoutez d'abord votre numéro de téléphone dans le profil. L'email sera lié à ce numéro.",
        },
        { status: 400 },
      )
    }

    let phoneE164 = profilePhone
    if (phoneRaw) {
      if (!validateWestAfricaPhone(phoneRaw, countryCode)) {
        return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 400 })
      }
      const nextPhone = formatPhoneE164(phoneRaw, countryCode)
      // Interdit de changer de numéro sans preuve OTP (évite takeover / collision)
      if (profilePhone && nextPhone !== profilePhone) {
        return NextResponse.json(
          {
            error:
              "Pour changer de numéro, utilisez la vérification SMS OTP depuis Connexion / Profil.",
            code: "PHONE_CHANGE_REQUIRES_OTP",
          },
          { status: 403 },
        )
      }
      phoneE164 = nextPhone
    }

    // Mettre à jour l'email Auth uniquement (pas de phone non vérifié)
    const { error: updateAuthError } = await supabase.auth.updateUser({
      email,
      data: {
        linked_email: email,
        auth_method: user.phone ? "phone" : "email",
      },
    })

    if (updateAuthError) {
      const msg = updateAuthError.message.includes("already")
        ? "Cet email est déjà utilisé par un autre compte"
        : updateAuthError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Email uniquement : le numéro N'EST JAMAIS écrit ici (même en premier set).
    // Un numéro ne peut être lié qu'après un OTP réussi (flow "bind phone" via
    // /api/auth/send-otp + /api/auth/verify-otp), sinon risque de takeover.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        email,
        linked_email: email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      email,
      phone: phoneE164,
      message:
        "Email lié à votre numéro. Un email de confirmation peut être envoyé par Supabase.",
      needs_email_confirmation: true,
    })
  } catch (err) {
    console.error("[auth/link-email]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
