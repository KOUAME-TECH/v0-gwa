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
  clearOtp,
} from "@/lib/auth/otp-store"
import { hasSmsProvider, sendSmsOtp } from "@/lib/auth/sms"

/**
 * POST /api/auth/send-otp
 * SMS via Twilio/AT/Termii (custom OTP). Login = numéro vérifié ;
 * signup = intent signup ; bind = session authentifiée.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, countryCode = "ci", intent = "login" } = body

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

    // Messages actionnables (sans takeover) :
    // - numéro vérifié ailleurs → connexion
    // - numéro présent non vérifié → email puis bind
    // - inconnu → inscription / email
    const alreadyUsed = NextResponse.json(
      {
        error:
          "Ce numéro est déjà associé à un compte. Connectez-vous avec ce numéro ou par email.",
        code: "PHONE_ALREADY_USED",
      },
      { status: 400 },
    )
    const needEmailVerify = NextResponse.json(
      {
        error:
          "Ce numéro est enregistré mais pas encore vérifié. Connectez-vous par email, puis validez-le dans Profil.",
        code: "PHONE_UNVERIFIED",
      },
      { status: 400 },
    )
    const unknownPhone = NextResponse.json(
      {
        error:
          "Aucun compte vérifié avec ce numéro. Inscrivez-vous ou connectez-vous par email.",
        code: "OTP_LOOKUP",
      },
      { status: 400 },
    )

    // Détermine le flow : bind | login | register
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
    let mode: "login" | "bind" | "register"

    if (sessionUser) {
      // BIND — l'utilisateur connecté lie ce numéro à son propre compte.
      if (
        profileByPhone &&
        profileByPhone.id !== sessionUser.id &&
        profileByPhone.phone_verified === true
      ) {
        return alreadyUsed
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
    } else if (profileByPhone?.phone_verified === true) {
      otpUserId = profileByPhone.id
      otpEmail = (profileByPhone.linked_email || profileByPhone.email || "")
        .trim()
        .toLowerCase()
      mode = "login"
    } else if (profileByPhone && profileByPhone.phone_verified !== true) {
      return needEmailVerify
    } else if (intent === "signup") {
      // REGISTER — nouveau numéro (inscription téléphone uniquement)
      otpUserId = "pending"
      otpEmail = ""
      mode = "register"
    } else {
      return unknownPhone
    }

    const linkedEmail = otpEmail

    // Préférer SMS custom (Twilio/AT) quand configuré — évite décalage Path A
    // Supabase (code différent / SMS jamais reçu) vs verify custom.
    if (mode === "login" && !hasSmsProvider()) {
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
          otp_mode: "supabase",
        })
      }

      console.warn("[auth/send-otp] supabase phone:", smsError.message)
      return unknownPhone
    }

    if (mode === "login" && !linkedEmail) {
      return NextResponse.json(
        {
          error:
            "Compte téléphone incomplet. Contactez le support ou utilisez l'email.",
          code: "PHONE_NO_EMAIL",
        },
        { status: 400 },
      )
    }

    // OTP custom + Twilio / AT / Termii
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
      email: linkedEmail || `${formatted.replace(/\D/g, "")}@users.gwa.local`,
      phone: formatted,
      mode,
    })

    const sms = await sendSmsOtp(formatted, code)
    if (!sms.success) {
      console.error("[auth/send-otp] sms", sms.error)
      // Fallback Path A (Supabase Phone) pour login si Twilio/AT down
      if (mode === "login") {
        const { error: smsError } = await supabase.auth.signInWithOtp({
          phone: formatted,
          options: { shouldCreateUser: false },
        })
        if (!smsError) {
          await clearOtp(formatted).catch(() => {})
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
            otp_mode: "supabase_fallback",
          })
        }
        console.warn("[auth/send-otp] supabase fallback:", smsError.message)
      }
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
      linked_email_masked: linkedEmail
        ? maskEmail(linkedEmail)
        : undefined,
      otp_mode: mode,
    })
  } catch (err) {
    console.error("[auth/send-otp]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
