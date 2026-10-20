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
  isOtpStoreReady,
} from "@/lib/auth/otp-store"
import {
  hasAfricasTalkingProvider,
  hasSmsProvider,
  hasTermiiProvider,
  hasTwilioProvider,
  shouldUseSupabasePhoneOtpFallback,
  sendSmsOtp,
} from "@/lib/auth/sms"

/**
 * POST /api/auth/send-otp
 *
 * Parcours indépendant du statut de liaison :
 * - login / signup : toujours envoyer un OTP si le numéro est valide
 *   (compte existant → login ; inconnu → register ; déjà « lié » → login)
 * - bind : session authentifiée qui attache le numéro à SON compte
 *
 * La fusion email/téléphone et la KYC (pièce + selfie) se font après, à part.
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

    const supabase = await createClient()
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser()

    const admin = createAdminClient()

    const { data: profileByPhone } = await admin
      .from("profiles")
      .select("id, email, linked_email, phone, phone_verified, full_name")
      .eq("phone", formatted)
      .maybeSingle()

    let otpUserId: string
    let otpEmail: string
    let mode: "login" | "bind" | "register"
    let accountHint: "existing" | "new" | "bind" = "new"

    if (sessionUser && intent === "bind") {
      // BIND — uniquement si l'utilisateur le demande explicitement (intent bind)
      if (
        profileByPhone &&
        profileByPhone.id !== sessionUser.id &&
        profileByPhone.phone_verified === true
      ) {
        return NextResponse.json(
          {
            error:
              "Ce numéro est déjà vérifié sur un autre compte. Connectez-vous avec ce numéro, puis liez vos comptes depuis Profil.",
            code: "PHONE_ON_OTHER_ACCOUNT",
            can_login: true,
          },
          { status: 409 },
        )
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
      accountHint = "bind"
    } else if (profileByPhone) {
      // Compte existant (vérifié OU non) → toujours login, jamais bloqué
      otpUserId = profileByPhone.id
      otpEmail = (profileByPhone.linked_email || profileByPhone.email || "")
        .trim()
        .toLowerCase()
      mode = "login"
      accountHint = "existing"
    } else {
      // Numéro inconnu → inscription (login ou signup aboutissent au même OTP)
      otpUserId = "pending"
      otpEmail = ""
      mode = "register"
      accountHint = "new"
    }

    // Session connectée sans intent bind : ne pas forcer bind ;
    // l'utilisateur peut se reconnecter avec un autre numéro (logout implicite côté client).
    if (sessionUser && intent !== "bind" && mode === "login") {
      // OK — login vers le compte du téléphone
    }

    const linkedEmail = otpEmail

    // Si Africa's Talking est configuré, on n'utilise PAS Supabase Phone en premier :
    // Supabase peut répondre OK sans SMS réel (crédits AT jamais débités).
    let supabasePhoneFailed = false
    if (
      shouldUseSupabasePhoneOtpFallback(
        mode,
        hasTwilioProvider(),
        hasAfricasTalkingProvider(),
        hasTermiiProvider(),
      )
    ) {
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
          account_hint: accountHint,
          phone_verified: profileByPhone?.phone_verified === true,
        })
      }

      supabasePhoneFailed = true
      console.warn("[auth/send-otp] Supabase phone OTP was rejected")
    }

    // Login custom OTP : email synthétique OK si pas d'email réel
    // (évite de bloquer les comptes téléphone-only)

    if (!hasSmsProvider() && mode !== "login") {
      return NextResponse.json(
        {
          error:
            "L'envoi de SMS est temporairement indisponible. Réessayez plus tard ou utilisez l'email.",
          code: "SMS_PROVIDER_MISSING",
        },
        { status: 503 },
      )
    }

    if (mode === "login" && !hasSmsProvider()) {
      return NextResponse.json(
        {
          error:
            "Impossible d'envoyer le SMS pour le moment. Réessayez plus tard.",
          code: "SMS_SEND_FAILED",
          hint: [
            supabasePhoneFailed ? "supabase:rejected" : null,
            "sms_provider:missing",
            "twilio_vercel:missing",
          ]
            .filter(Boolean)
            .join(" | "),
        },
        { status: 502 },
      )
    }

    if (!isOtpStoreReady()) {
      return NextResponse.json(
        {
          error: "Le stockage sécurisé des codes SMS n'est pas configuré.",
          code: "OTP_STORAGE_NOT_CONFIGURED",
        },
        { status: 503 },
      )
    }

    if (!(await canSendOtp(formatted, 55))) {
      return NextResponse.json(
        { error: "Patientez 1 minute avant de renvoyer un code." },
        { status: 429 },
      )
    }

    const code = generateOtpCode()
    const storeEmail =
      linkedEmail || `${formatted.replace(/\D/g, "")}@users.gwa.local`

    await storeOtp(formatted, {
      code,
      userId: otpUserId,
      email: storeEmail,
      phone: formatted,
      mode,
    })

    const sms = await sendSmsOtp(formatted, code)
    if (!sms.success) {
      console.error("[auth/send-otp] SMS provider rejected OTP", sms.provider || "unknown")
      // Pas de fallback Supabase Phone si AT est le provider choisi :
      // sinon l'UI dit « envoyé » alors que le SMS n'arrive jamais.
      if (mode === "login" && !hasAfricasTalkingProvider()) {
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
            account_hint: accountHint,
          })
        }
        supabasePhoneFailed = true
        console.warn("[auth/send-otp] Supabase fallback rejected OTP")
      }
      const hintParts = [
        sms.provider
          ? `${sms.provider}:${(sms.error || "fail").slice(0, 120)}`
          : null,
        supabasePhoneFailed ? "supabase:rejected" : null,
        !hasTwilioProvider() ? "twilio_vercel:missing" : null,
      ].filter(Boolean)
      return NextResponse.json(
        {
          error:
            "Impossible d'envoyer le SMS pour le moment. Réessayez plus tard.",
          code: "SMS_SEND_FAILED",
          hint: hintParts.join(" | ") || undefined,
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
      otp_mode: mode,
      account_hint: accountHint,
      phone_verified: profileByPhone?.phone_verified === true,
      ...(sms.warning ? { delivery_warning: sms.warning } : {}),
    })
  } catch (err) {
    console.error("[auth/send-otp]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
