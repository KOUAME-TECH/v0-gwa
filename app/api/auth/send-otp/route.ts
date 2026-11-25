import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, rateLimit } from "@/lib/security/rate-limiter"
import {
  formatPhoneE164,
  validateWestAfricaPhone,
  maskPhone,
} from "@/lib/auth/phone"
import {
  generateOtpCode,
  storeOtp,
  clearOtp,
  canSendOtp,
  releaseSendOtp,
  isOtpStoreReady,
  recordSmsOpsFailure,
  OTP_POLICY,
} from "@/lib/auth/otp-store"
import {
  hasSmsProvider,
  sendSmsOtp,
} from "@/lib/auth/sms"

/** Mappe erreurs provider → code ops (jamais de secret / raw AT). */
function mapSmsFailureCode(error?: string): string {
  const msg = (error || "").toLowerCase()
  if (msg.includes("sandbox") || msg.includes("at_username")) return "AT_SANDBOX"
  if (
    msg.includes("balance") ||
    msg.includes("credit") ||
    msg.includes("insufficient") ||
    msg.includes("userisinactive") ||
    msg.includes("not enough")
  )
    return "SMS_CREDITS"
  if (
    msg.includes("sender") ||
    msg.includes("from") ||
    msg.includes("invalidsenderid") ||
    msg.includes("alphanumeric")
  )
    return "AT_SENDER"
  if (msg.includes("invalid") && (msg.includes("number") || msg.includes("phone")))
    return "SMS_INVALID_NUMBER"
  if (msg.includes("rejected") || msg.includes("blocked") || msg.includes("risk"))
    return "SMS_REJECTED"
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("econn"))
    return "SMS_NETWORK"
  if (msg.includes("non configuré") || msg.includes("aucun fournisseur"))
    return "SMS_UNCONFIGURED"
  return "SMS_PROVIDER_REJECTED"
}

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

    const shortLimit = await checkRateLimit("OTP_REQUEST", formatted)
    // Politique : 5 envois par heure et par numéro.
    const hourLimit = await rateLimit(`OTP_SEND_H:${formatted}`, OTP_POLICY.sendPerHour)
    const limit = !shortLimit.success ? shortLimit : !hourLimit.success ? hourLimit : null
    if (limit) {
      const waitMin = Math.ceil((limit.resetAt - Date.now()) / 60000)
      return NextResponse.json(
        {
          error: limit.blocked
            ? `Trop de tentatives. Réessayez dans ${waitMin} min.`
            : `Limite atteinte. Réessayez dans ${waitMin} min.`,
          retry_after: Math.max(0, Math.ceil((limit.resetAt - Date.now()) / 1000)),
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
    } else if (profileByPhone) {
      // Compte existant (vérifié OU non) → toujours login, jamais bloqué
      otpUserId = profileByPhone.id
      otpEmail = (profileByPhone.linked_email || profileByPhone.email || "")
        .trim()
        .toLowerCase()
      mode = "login"
    } else {
      // Numéro inconnu → inscription (login ou signup aboutissent au même OTP)
      otpUserId = "pending"
      otpEmail = ""
      mode = "register"
    }

    // Session connectée sans intent bind : ne pas forcer bind ;
    // l'utilisateur peut se reconnecter avec un autre numéro (logout implicite côté client).
    if (sessionUser && intent !== "bind" && mode === "login") {
      // OK — login vers le compte du téléphone
    }

    const linkedEmail = otpEmail

    // Login custom OTP : email synthétique OK si pas d'email réel
    // (évite de bloquer les comptes téléphone-only)

    if (!hasSmsProvider()) {
      return NextResponse.json(
        {
          error:
            "L'envoi de SMS est temporairement indisponible. Réessayez plus tard ou utilisez l'email.",
          code: "SMS_UNAVAILABLE",
        },
        { status: 503 },
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
      // Rollback : ne pas laisser un OTP ni un cooldown si le SMS n'est pas parti.
      try {
        await clearOtp(formatted)
        await releaseSendOtp(formatted)
      } catch (rollbackErr) {
        console.error("[auth/send-otp] rollback after SMS failure", rollbackErr)
      }
      const failureCode = mapSmsFailureCode(sms.error)
      try {
        await recordSmsOpsFailure(failureCode, sms.provider || null)
      } catch (opsErr) {
        console.error("[auth/send-otp] recordSmsOpsFailure", opsErr)
      }
      console.error(
        "[auth/send-otp] SMS provider rejected OTP",
        sms.provider || "unknown",
        failureCode,
      )
      return NextResponse.json(
        {
          error:
            "Impossible d'envoyer le SMS pour le moment. Réessayez plus tard.",
          code: failureCode,
          provider: sms.provider || null,
          // Cooldown libéré → le client peut renvoyer immédiatement.
          retry_after: 0,
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
      expires_in: OTP_POLICY.ttlSeconds,
      resend_after: 60,
      ...(sms.warning ? { delivery_warning: sms.warning } : {}),
    })
  } catch (err) {
    console.error("[auth/send-otp]", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
