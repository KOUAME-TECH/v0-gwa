import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import {
  formatPhoneE164,
  validateWestAfricaPhone,
  maskPhone,
  maskEmail,
} from "@/lib/auth/phone"
import {
  generateOtpCode,
  storeOtp,
  canSendOtp,
} from "@/lib/auth/otp-store"
import { hasSmsProvider, sendSmsOtp } from "@/lib/auth/sms"

/**
 * POST /api/auth/send-otp
 * SMS obligatoire. Le numéro doit être lié au compte email de 1ère inscription.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, countryCode = "ci" } = body

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Numéro de téléphone requis" },
        { status: 400 },
      )
    }

    const formatted = formatPhoneE164(phone, countryCode)
    if (!formatted || !validateWestAfricaPhone(phone, countryCode)) {
      return NextResponse.json(
        {
          error:
            "Numéro invalide. Ex CI : 07 88 32 60 19 (10 chiffres, préfixe 07/05/01)",
        },
        { status: 400 },
      )
    }

    const rateLimit = await checkRateLimit("OTP_REQUEST", formatted)
    if (!rateLimit.success) {
      const waitMin = Math.ceil((rateLimit.resetAt - Date.now()) / 60000)
      return NextResponse.json(
        {
          error: rateLimit.blocked
            ? `Trop de tentatives. Réessayez dans ${waitMin} min.`
            : "Limite atteinte. Patientez avant de renvoyer un code.",
          retry_after: Math.max(
            0,
            Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
          ),
        },
        { status: 429 },
      )
    }

    if (!hasSmsProvider()) {
      return NextResponse.json(
        {
          error:
            "SMS non configuré. Ajoutez AT_USERNAME + AT_API_KEY (Africa's Talking) sur Vercel.",
          code: "SMS_PROVIDER_MISSING",
        },
        { status: 503 },
      )
    }

    // Réponse générique anti-énumération : identique que le numéro soit inconnu,
    // non lié ou non vérifié — n'expose jamais l'existence d'un compte.
    const genericDenied = NextResponse.json(
      {
        error:
          "Si ce numéro est lié à un compte vérifié, un code sera envoyé. Sinon connectez-vous par email puis liez votre numéro dans Profil.",
        code: "OTP_LOOKUP",
      },
      { status: 400 },
    )

    // Détermine le flow : bind (utilisateur authentifié qui lie SON numéro) ou
    // login (numéro déjà lié ET vérifié). On ne fait JAMAIS de lookup-then-login
    // sur un numéro non vérifié (risque de takeover).
    const supabase = await createClient()
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser()

    const admin = createAdminClient()

    // Match E.164 exact uniquement (pas de fuzzy last-9 — risque de takeover)
    const { data: profileByPhone } = await admin
      .from("profiles")
      .select("id, email, linked_email, phone, phone_verified, full_name")
      .eq("phone", formatted)
      .maybeSingle()

    let otpUserId: string
    let otpEmail: string
    let mode: "login" | "bind"

    if (sessionUser) {
      // BIND — l'utilisateur connecté lie ce numéro à son propre compte.
      // Refus si le numéro est déjà vérifié sur un AUTRE compte (anti-takeover).
      if (
        profileByPhone &&
        profileByPhone.id !== sessionUser.id &&
        profileByPhone.phone_verified === true
      ) {
        return genericDenied
      }
      const { data: ownProfile } = await admin
        .from("profiles")
        .select("id, email, linked_email")
        .eq("id", sessionUser.id)
        .maybeSingle()
      otpUserId = sessionUser.id
      otpEmail = (
        ownProfile?.linked_email ||
        ownProfile?.email ||
        sessionUser.email ||
        ""
      )
        .trim()
        .toLowerCase()
      mode = "bind"
    } else {
      // LOGIN — autorisé uniquement si le numéro est lié ET vérifié.
      if (!profileByPhone || profileByPhone.phone_verified !== true) {
        return genericDenied
      }
      otpUserId = profileByPhone.id
      otpEmail = (profileByPhone.linked_email || profileByPhone.email || "")
        .trim()
        .toLowerCase()
      mode = "login"
    }

    const linkedEmail = otpEmail

    // 1) SMS natif Supabase (Path A) — login d'un numéro déjà vérifié seulement.
    //    (En bind, l'utilisateur a déjà une session : on ne mint pas de session phone.)
    if (mode === "login") {
      const { error: smsError } = await supabase.auth.signInWithOtp({
        phone: formatted,
        options: { shouldCreateUser: false },
      })

      if (!smsError) {
        return NextResponse.json({
          success: true,
          phone: formatted,
          masked_phone: maskPhone(formatted),
          channel: "sms",
          message: "Code SMS envoyé",
          expires_in: 600,
          resend_after: 60,
          linked_email_masked: linkedEmail
            ? maskEmail(linkedEmail)
            : undefined,
        })
      }

      console.warn("[auth/send-otp] supabase phone:", smsError.message)
    }

    // 2) OTP custom + SMS Twilio/Termii (obligatoire)
    if (!(await canSendOtp(formatted, 55))) {
      return NextResponse.json(
        { error: "Patientez 1 minute avant de renvoyer un code." },
        { status: 429 },
      )
    }

    const code = generateOtpCode()
    await storeOtp(formatted, {
      code,
      userId: otpUserId,
      email: linkedEmail,
      phone: formatted,
      mode,
    })

    const sms = await sendSmsOtp(formatted, code)
    if (!sms.success) {
      console.error("[auth/send-otp] sms", sms.error)
      return NextResponse.json(
        {
          error:
            "Impossible d'envoyer le SMS pour le moment. Réessayez plus tard.",
          code: "SMS_SEND_FAILED",
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      phone: formatted,
      masked_phone: maskPhone(formatted),
      channel: "sms",
      provider: sms.provider,
      message: "Code SMS envoyé",
      expires_in: 600,
      resend_after: 60,
      linked_email_masked: linkedEmail ? maskEmail(linkedEmail) : undefined,
      otp_mode: "sms",
    })
  } catch (err) {
    console.error("[auth/send-otp]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
